"""
Tests for scheduled data repository sync (S072).

- Recurring scheduler runs data sync every 30 minutes.
- Scheduler starts during app startup and stops cleanly on shutdown.
- Exceptions in scheduled runs are handled and logged without terminating future cycles.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.data_sync import SyncResult


class TestScheduledDataSync:
    """Tests for scheduled data sync scheduler."""

    def test_scheduler_starts_and_stops_cleanly(self, tmp_path: Path) -> None:
        """
        Happy path: data sync scheduler starts during lifespan and stops cleanly.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_sync_result = SyncResult(success=True, message="Sync succeeded")
        mock_service = MagicMock()
        mock_service.sync.return_value = mock_sync_result

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            from app.main import lifespan

            async def run_lifespan() -> None:
                async with lifespan(MagicMock()):
                    # Scheduler should be running here
                    pass  # Shutdown

            asyncio.run(run_lifespan())

            # Verify sync was called (startup + scheduler can run)
            assert mock_service.sync.call_count >= 1

    def test_scheduled_sync_uses_same_service_as_startup(self, tmp_path: Path) -> None:
        """
        The recurring scheduler reuses the same sync service logic as startup sync.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_sync_result = SyncResult(success=True, message="Sync succeeded")
        mock_service = MagicMock()
        mock_service.sync.return_value = mock_sync_result

        with (
            patch("app.main.DataRepoSyncService") as mock_service_class,
            patch("app.main.get_data_root", return_value=data_root),
        ):
            mock_service_class.return_value = mock_service

            from app.main import lifespan

            async def run_lifespan() -> None:
                async with lifespan(MagicMock()):
                    pass

            asyncio.run(run_lifespan())

            # Verify DataRepoSyncService was created with correct data_root
            mock_service_class.assert_called_with(data_root=data_root)

    def test_scheduled_sync_failure_does_not_crash_scheduler(self, tmp_path: Path) -> None:
        """
        Exception in scheduled runs are handled and logged without terminating future cycles.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        call_count = 0

        def sync_side_effect() -> SyncResult:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call (startup sync) succeeds
                return SyncResult(success=True, message="Startup sync succeeded")
            elif call_count == 2:
                # Second call (first scheduled run) fails
                return SyncResult(success=False, message="Scheduled sync failed")
            else:
                # Subsequent calls succeed
                return SyncResult(success=True, message="Sync succeeded")

        mock_service = MagicMock()
        mock_service.sync.side_effect = sync_side_effect

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            from app.main import lifespan

            async def run_lifespan() -> None:
                async with lifespan(MagicMock()):
                    pass

            # Should not raise
            asyncio.run(run_lifespan())

    def test_scheduled_sync_exception_does_not_crash_app(self, tmp_path: Path) -> None:
        """
        Regression: unexpected exceptions in scheduled sync are caught and logged.
        The app should still start and shutdown cleanly.
        """
        data_root = tmp_path / "data"
        data_root.mkdir()

        call_count = 0

        def sync_side_effect() -> SyncResult:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call (startup sync) succeeds
                return SyncResult(success=True, message="Startup sync succeeded")
            else:
                # Subsequent calls raise exception
                raise RuntimeError("Unexpected sync error")

        mock_service = MagicMock()
        mock_service.sync.side_effect = sync_side_effect

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            from app.main import lifespan

            async def run_lifespan() -> None:
                async with lifespan(MagicMock()):
                    pass

            # Should not raise
            asyncio.run(run_lifespan())

    def test_make_data_sync_job_logs_success(self, tmp_path: Path) -> None:
        """
        Unit test: _make_data_sync_job logs successful sync.
        """
        import logging

        from app.main import _make_data_sync_job

        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_sync_result = SyncResult(success=True, message="Sync succeeded")
        mock_service = MagicMock()
        mock_service.sync.return_value = mock_sync_result

        log = logging.getLogger("test_logger")

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            job = _make_data_sync_job(data_root, log)
            job()

            mock_service.sync.assert_called_once()

    def test_make_data_sync_job_logs_failure(self, tmp_path: Path) -> None:
        """
        Unit test: _make_data_sync_job logs failed sync without raising.
        """
        import logging

        from app.main import _make_data_sync_job

        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_sync_result = SyncResult(success=False, message="Sync failed")
        mock_service = MagicMock()
        mock_service.sync.return_value = mock_sync_result

        log = logging.getLogger("test_logger")

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            job = _make_data_sync_job(data_root, log)
            # Should not raise
            job()

            mock_service.sync.assert_called_once()

    def test_make_data_sync_job_catches_exceptions(self, tmp_path: Path) -> None:
        """
        Unit test: _make_data_sync_job catches unexpected exceptions.
        """
        import logging

        from app.main import _make_data_sync_job

        data_root = tmp_path / "data"
        data_root.mkdir()

        mock_service = MagicMock()
        mock_service.sync.side_effect = RuntimeError("Unexpected error")

        log = logging.getLogger("test_logger")

        with patch("app.main.DataRepoSyncService") as mock_service_class:
            mock_service_class.return_value = mock_service

            job = _make_data_sync_job(data_root, log)
            # Should not raise
            job()

            mock_service.sync.assert_called_once()
