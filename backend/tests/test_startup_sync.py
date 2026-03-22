"""
Tests for data repository sync integration with backend startup (S071).

- One sync cycle runs during FastAPI lifespan startup.
- Startup remains resilient when sync fails (error logged, app still starts).
- Recurring scheduler also runs sync periodically (S072).
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.data_sync import SyncResult


class TestStartupSync:
    """Tests for data sync integration at backend startup."""

    def test_sync_called_at_startup(self, tmp_path: Path) -> None:
        """
        Happy path: data sync is called during backend startup.

        Note: With the recurring scheduler (S072), sync may be called multiple times
        during the lifespan test (startup + scheduler runs). We verify at least one call.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_sync_result = SyncResult(success=True, message="Sync succeeded")
        mock_service = MagicMock()
        mock_service.sync.return_value = mock_sync_result

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            # Import lifespan here to pick up the patched DataRepoSyncService
            from app.main import lifespan

            # Run the lifespan context manager
            async def run_lifespan() -> None:
                async with lifespan(MagicMock()):
                    pass  # Startup completed

            asyncio.run(run_lifespan())

            # Verify sync was called at least once (startup)
            assert mock_service.sync.call_count >= 1

    def test_startup_resilient_when_sync_fails(self, tmp_path: Path) -> None:
        """
        Startup remains resilient when sync fails.
        The app should still start; the error should be logged.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_sync_result = SyncResult(success=False, message="Not a git repository")
        mock_service = MagicMock()
        mock_service.sync.return_value = mock_sync_result

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            from app.main import lifespan

            # Run the lifespan context manager
            async def run_lifespan() -> None:
                async with lifespan(MagicMock()):
                    pass  # Should reach here even if sync fails

            # The lifespan context manager should NOT raise an exception
            asyncio.run(run_lifespan())

            # Verify sync was called at least once
            assert mock_service.sync.call_count >= 1

    def test_startup_resilient_when_sync_raises_exception(self, tmp_path: Path) -> None:
        """
        Regression: startup remains resilient even when sync raises an unexpected exception.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_service = MagicMock()
        mock_service.sync.side_effect = RuntimeError("Unexpected error during sync")

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            from app.main import lifespan

            # Run the lifespan context manager
            async def run_lifespan() -> None:
                async with lifespan(MagicMock()):
                    pass  # Should reach here even if sync raises

            # The lifespan context manager should NOT raise an exception
            asyncio.run(run_lifespan())

            # Verify sync was attempted at least once
            assert mock_service.sync.call_count >= 1
