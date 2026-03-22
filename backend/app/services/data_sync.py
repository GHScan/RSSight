"""
Data repository sync service for git pull/rebase and push.

This service performs a sync cycle for the data directory:
1. Resolve symlink target if applicable
2. Verify it's a git repository
3. Check for configured remote
4. Pull with rebase from remote
5. If local changes exist, stage, commit, and push

Failures are logged with actionable messages and do not crash the process.
"""

from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

# Type alias for git command runner
RunGitCallable = Callable[..., subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class SyncResult:
    """Result of a data repo sync operation."""

    success: bool
    message: str


class DataRepoSyncService:
    """
    Syncs the data directory with its git remote.

    The sync flow:
    1. Resolve symlink target if data_root is a symlink
    2. Check if the directory is a git repository
    3. Check if a remote (origin) is configured
    4. Pull with rebase from the remote
    5. If there are local changes, stage, commit, and push

    All git operations use the injectable `run_git` callable for testability.
    """

    def __init__(
        self,
        data_root: Path,
        run_git: RunGitCallable | None = None,
        logger_: logging.Logger | None = None,
    ) -> None:
        self._data_root = data_root
        self._run_git: RunGitCallable = run_git or self._default_run_git
        self._logger = logger_ or logger

    def _default_run_git(
        self, cmd: list[str], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        """Default git command runner using subprocess.run."""
        # Extract known subprocess.run kwargs
        cwd = kwargs.get("cwd")
        return subprocess.run(  # noqa: S603
            cmd,
            capture_output=True,
            text=True,
            cwd=cwd if isinstance(cwd, (str, Path)) else None,
        )

    def _resolve_target(self) -> Path:
        """Resolve symlink target if data_root is a symlink."""
        path = self._data_root
        while path.is_symlink():
            path = path.resolve()
        return path

    def _is_git_repo(self, cwd: Path) -> bool:
        """Check if the directory is a git repository."""
        result = self._run_git(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=cwd,
        )
        return result.returncode == 0 and "true" in result.stdout.lower()

    def _has_remote(self, cwd: Path, remote: str = "origin") -> bool:
        """Check if the given remote is configured."""
        result = self._run_git(
            ["git", "remote", "get-url", remote],
            cwd=cwd,
        )
        return result.returncode == 0

    def _has_local_changes(self, cwd: Path) -> bool:
        """Check if the working tree has local changes."""
        result = self._run_git(
            ["git", "status", "--porcelain"],
            cwd=cwd,
        )
        return result.returncode == 0 and bool(result.stdout.strip())

    def _pull_rebase(self, cwd: Path, remote: str = "origin") -> tuple[bool, str]:
        """Pull with rebase from the remote. Returns (success, error_message)."""
        result = self._run_git(
            ["git", "pull", "--rebase", remote],
            cwd=cwd,
        )
        if result.returncode != 0:
            error = result.stderr.strip()
            return False, error
        return True, ""

    def _stage_all(self, cwd: Path) -> bool:
        """Stage all changes. Returns True on success."""
        result = self._run_git(
            ["git", "add", "-A"],
            cwd=cwd,
        )
        return result.returncode == 0

    def _commit(self, cwd: Path, message: str = "Auto-sync: local changes") -> bool:
        """Commit staged changes. Returns True on success."""
        result = self._run_git(
            ["git", "commit", "-m", message],
            cwd=cwd,
        )
        return result.returncode == 0

    def _push(self, cwd: Path, remote: str = "origin") -> tuple[bool, str]:
        """Push to the remote. Returns (success, error_message)."""
        result = self._run_git(
            ["git", "push", remote],
            cwd=cwd,
        )
        if result.returncode != 0:
            error = result.stderr.strip()
            return False, error
        return True, ""

    def sync(self) -> SyncResult:
        """
        Perform a sync cycle.

        Returns a SyncResult indicating success/failure and a message.
        """
        # Step 1: Resolve symlink target
        target = self._resolve_target()
        self._logger.info(f"Data sync: resolved path {self._data_root} -> {target}")

        # Step 2: Check if it's a git repo
        if not self._is_git_repo(target):
            msg = f"Not a git repository: {target}"
            self._logger.error(f"Data sync failed: {msg}")
            return SyncResult(success=False, message=msg)

        # Step 3: Check for remote
        remote = "origin"
        if not self._has_remote(target, remote):
            msg = f"No remote '{remote}' configured for {target}"
            self._logger.error(f"Data sync failed: {msg}")
            return SyncResult(success=False, message=msg)

        # Step 4: Pull with rebase
        success, error = self._pull_rebase(target, remote)
        if not success:
            msg = f"Pull/rebase failed: {error}"
            self._logger.error(f"Data sync failed: {msg}")
            return SyncResult(success=False, message=msg)

        self._logger.info(f"Data sync: pull/rebase succeeded for {target}")

        # Step 5: Check for local changes and push if any
        if self._has_local_changes(target):
            self._logger.info("Data sync: local changes detected, committing and pushing")

            if not self._stage_all(target):
                msg = "Failed to stage changes"
                self._logger.error(f"Data sync failed: {msg}")
                return SyncResult(success=False, message=msg)

            if not self._commit(target):
                msg = "Failed to commit changes"
                self._logger.error(f"Data sync failed: {msg}")
                return SyncResult(success=False, message=msg)

            success, error = self._push(target, remote)
            if not success:
                msg = f"Push failed: {error}"
                self._logger.error(f"Data sync failed: {msg}")
                return SyncResult(success=False, message=msg)

            self._logger.info(f"Data sync: committed and pushed changes to {target}")
        else:
            self._logger.info(f"Data sync: no local changes to commit for {target}")

        return SyncResult(success=True, message="Sync completed successfully")
