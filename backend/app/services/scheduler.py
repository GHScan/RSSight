"""
Scheduled feed fetch: runs fetch_all at a fixed interval in a background thread.

The scheduler is injectable and testable: run_once() runs the job once without
starting the background thread. Manual triggers and scheduled runs share the
same fetch_all callable.
"""

from __future__ import annotations

import logging
import threading
from typing import Callable

logger = logging.getLogger(__name__)


class FeedFetchScheduler:
    """
    Runs a fetch-all callable at a fixed interval in a background thread.

    - start(): start the background thread.
    - stop(): signal the thread to stop and join.
    - run_once(): run the job once (for tests or manual trigger); exceptions
      from the job are logged and not re-raised so the scheduler keeps running.
    """

    def __init__(self, fetch_all: Callable[[], None], interval_seconds: float = 60.0) -> None:
        self._fetch_all = fetch_all
        self._interval_seconds = interval_seconds
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._fetch_all()
            except Exception:  # noqa: BLE001
                logger.exception("Scheduled feed fetch job failed")
            self._stop_event.wait(timeout=self._interval_seconds)

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=self._interval_seconds * 2)
            self._thread = None

    def run_once(self) -> None:
        """Run the fetch job once. Logs and swallows exceptions."""
        try:
            self._fetch_all()
        except Exception:  # noqa: BLE001
            logger.exception("Feed fetch job failed")
