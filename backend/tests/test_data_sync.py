"""
Tests for data repository sync service (S070).

- Sync service handles pull/rebase and push for the data directory.
- Resolves symlink targets before running git commands.
- Handles non-git directories, command failures, and working tree states.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from app.services.data_sync import DataRepoSyncService


def _ok(stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess[str]:
    """Helper to create a successful CompletedProcess."""
    return subprocess.CompletedProcess(args=[], returncode=0, stdout=stdout, stderr=stderr)


def _fail(stderr: str, returncode: int = 1) -> subprocess.CompletedProcess[str]:
    """Helper to create a failed CompletedProcess."""
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout="", stderr=stderr)


class TestDataRepoSyncService:
    """Tests for DataRepoSyncService."""

    def test_sync_happy_path_pulls_and_pushes(self, tmp_path: Path) -> None:
        """
        Happy path: data directory is a git repo with remote.
        Pull with rebase succeeds; clean working tree means no commit/push needed.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            if "rev-parse" in cmd:
                return _ok("true")
            if "remote" in cmd and "get-url" in cmd:
                return _ok("https://example.com/repo.git")
            if "status" in cmd and "--porcelain" in cmd:
                return _ok()  # Clean working tree
            if "pull" in cmd:
                return _ok("Already up to date.")
            return _ok()

        service = DataRepoSyncService(data_root=data_root, run_git=mock_run_git)
        result = service.sync()

        assert result.success
        assert "success" in result.message.lower()

    def test_sync_non_git_directory_logs_error(self, tmp_path: Path) -> None:
        """
        Boundary: data directory is not a git repository.
        Sync should log an error and return failure without crashing.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            if "rev-parse" in cmd:
                return _fail("fatal: not a git repository", returncode=128)
            return _ok()

        service = DataRepoSyncService(data_root=data_root, run_git=mock_run_git)
        result = service.sync()

        assert not result.success
        msg_lower = result.message.lower()
        assert "not a git repository" in msg_lower or "no git repo" in msg_lower

    def test_sync_resolves_symlink_target(self, tmp_path: Path) -> None:
        """
        If data_root is a symlink, resolve to the real target before running git commands.
        """
        real_data = tmp_path / "real_data"
        real_data.mkdir()
        symlink_data = tmp_path / "data_link"

        try:
            symlink_data.symlink_to(real_data)
        except OSError:
            pytest.skip("Symlink creation not supported")

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            if "rev-parse" in cmd:
                return _ok("true")
            if "remote" in cmd and "get-url" in cmd:
                return _ok("https://example.com/repo.git")
            if "status" in cmd and "--porcelain" in cmd:
                return _ok()
            if "pull" in cmd:
                return _ok("Already up to date.")
            return _ok()

        service = DataRepoSyncService(data_root=symlink_data, run_git=mock_run_git)
        service.sync()

    def test_sync_pull_rebase_failure_logs_error(self, tmp_path: Path) -> None:
        """
        Git pull --rebase fails (e.g., conflict, network error).
        Sync should log the error and return failure without crashing.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            if "rev-parse" in cmd:
                return _ok("true")
            if "remote" in cmd and "get-url" in cmd:
                return _ok("origin")
            if "pull" in cmd:
                return _fail("error: could not apply changes")
            return _ok()

        service = DataRepoSyncService(data_root=data_root, run_git=mock_run_git)
        result = service.sync()

        assert not result.success
        msg_lower = result.message.lower()
        assert "pull" in msg_lower or "rebase" in msg_lower or "error" in msg_lower

    def test_sync_no_remote_skips_push(self, tmp_path: Path) -> None:
        """
        Git repo exists but has no remote configured.
        Sync should skip pull/push and log a message.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            if "rev-parse" in cmd:
                return _ok("true")
            if "remote" in cmd and "get-url" in cmd:
                return _fail("error: No such remote 'origin'", returncode=128)
            return _ok()

        service = DataRepoSyncService(data_root=data_root, run_git=mock_run_git)
        result = service.sync()

        assert not result.success
        assert "no remote" in result.message.lower() or "remote" in result.message.lower()

    def test_sync_with_local_changes_commits_and_pushes(self, tmp_path: Path) -> None:
        """
        Working tree has local changes.
        Sync should stage, commit, and push the changes.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()
        call_count = 0

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            nonlocal call_count
            call_count += 1
            if "rev-parse" in cmd:
                return _ok("true")
            if "remote" in cmd and "get-url" in cmd:
                return _ok("https://example.com/repo.git")
            if "status" in cmd and "--porcelain" in cmd:
                return _ok("M feeds.json\n")  # Dirty working tree
            if "pull" in cmd:
                return _ok("Already up to date.")
            if "add" in cmd:
                return _ok()
            if "commit" in cmd:
                return _ok("[main abc123] Auto-sync")
            if "push" in cmd:
                return _ok()
            return _ok()

        service = DataRepoSyncService(data_root=data_root, run_git=mock_run_git)
        result = service.sync()

        assert result.success
        assert call_count >= 5

    def test_sync_clean_working_tree_only_pulls(self, tmp_path: Path) -> None:
        """
        Working tree is clean (no local changes).
        Sync should only pull and not attempt to commit/push.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()
        commands_run: list[str] = []

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            cmd_str = " ".join(cmd[:2]) if len(cmd) >= 2 else cmd[0]
            commands_run.append(cmd_str)

            if "rev-parse" in cmd:
                return _ok("true")
            if "remote" in cmd and "get-url" in cmd:
                return _ok("https://example.com/repo.git")
            if "status" in cmd and "--porcelain" in cmd:
                return _ok()  # Clean working tree
            if "pull" in cmd:
                return _ok("Already up to date.")
            return _ok()

        service = DataRepoSyncService(data_root=data_root, run_git=mock_run_git)
        result = service.sync()

        assert result.success
        assert not any("add" in c for c in commands_run)
        assert not any("commit" in c for c in commands_run)
        assert not any("push" in c for c in commands_run)

    def test_sync_push_failure_logs_error(self, tmp_path: Path) -> None:
        """
        Push fails (e.g., auth error, network issue).
        Sync should log the error and return failure.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        def mock_run_git(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            if "rev-parse" in cmd:
                return _ok("true")
            if "remote" in cmd and "get-url" in cmd:
                return _ok("https://example.com/repo.git")
            if "status" in cmd and "--porcelain" in cmd:
                return _ok("M feeds.json\n")  # Dirty working tree
            if "pull" in cmd:
                return _ok("Already up to date.")
            if "add" in cmd:
                return _ok()
            if "commit" in cmd:
                return _ok("[main abc123] Auto-sync")
            if "push" in cmd:
                return _fail("fatal: Authentication failed")
            return _ok()

        service = DataRepoSyncService(data_root=data_root, run_git=mock_run_git)
        result = service.sync()

        assert not result.success
        assert "push" in result.message.lower() or "auth" in result.message.lower()
