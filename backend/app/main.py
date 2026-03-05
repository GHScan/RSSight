from pathlib import Path

from fastapi import FastAPI

from app.api.feeds import router as feeds_router


def get_data_root() -> Path:
    """
    Return the root directory for all business data.

    By default this points to the project-level ``data`` directory.
    """

    # backend/app/main.py -> backend/app -> backend -> project root
    return Path(__file__).resolve().parents[2] / "data"


app = FastAPI(title="WebRSSReader API", version="0.1.0")

app.include_router(feeds_router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
