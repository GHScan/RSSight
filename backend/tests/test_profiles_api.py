"""
API tests for summary profile management (S003).

Tests cover create, update, delete, query and name uniqueness.
"""

from pathlib import Path
from typing import Callable

from fastapi.testclient import TestClient

from app.main import app


def _override_data_root(tmp_path: Path) -> Callable[[], Path]:
    def _get_root() -> Path:
        return tmp_path

    return _get_root


def test_create_and_list_profiles_happy_path(tmp_path: Path, monkeypatch) -> None:
    """
    Happy path: creating a profile persists it and it is returned by list.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post(
        "/api/summary-profiles",
        json={
            "name": "default",
            "base_url": "https://api.openai.com/v1",
            "key": "sk-secret",
            "model": "gpt-4",
            "fields": ["title", "content"],
            "prompt_template": "Summarize: {{title}}",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "default"
    assert created["base_url"] == "https://api.openai.com/v1"
    assert created["model"] == "gpt-4"
    assert created["fields"] == ["title", "content"]
    assert created["prompt_template"] == "Summarize: {{title}}"

    list_response = client.get("/api/summary-profiles")
    assert list_response.status_code == 200
    profiles = list_response.json()
    assert len(profiles) == 1
    assert profiles[0]["name"] == "default"


def test_create_duplicate_profile_name_returns_409(tmp_path: Path, monkeypatch) -> None:
    """
    Boundary: creating a second profile with the same name must fail with 409.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    payload = {
        "name": "unique",
        "base_url": "https://api.example.com",
        "key": "key1",
        "model": "gpt-4",
        "fields": ["title"],
        "prompt_template": "{{title}}",
    }
    client.post("/api/summary-profiles", json=payload)
    duplicate_response = client.post("/api/summary-profiles", json=payload)

    assert duplicate_response.status_code == 409
    body = duplicate_response.json()
    assert body.get("code") == "PROFILE_NAME_EXISTS"
    assert "message" in body
    assert "details" in body


def test_update_nonexistent_profile_returns_404(tmp_path: Path, monkeypatch) -> None:
    """
    Boundary: updating a profile that does not exist returns 404.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    response = client.put(
        "/api/summary-profiles/nonexistent",
        json={"model": "gpt-3.5"},
    )
    assert response.status_code == 404
    body = response.json()
    assert body.get("code") == "PROFILE_NOT_FOUND"
    assert "details" in body


def test_delete_profile_removes_from_storage(tmp_path: Path, monkeypatch) -> None:
    """
    Regression: deleting a profile removes it from the index file and it is no longer listed.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post(
        "/api/summary-profiles",
        json={
            "name": "to-delete",
            "base_url": "https://api.example.com",
            "key": "k",
            "model": "gpt-4",
            "fields": [],
            "prompt_template": "x",
        },
    )
    assert create_response.status_code == 201
    index_path = tmp_path / "summary_profiles.json"
    assert index_path.exists()

    delete_response = client.delete("/api/summary-profiles/to-delete")
    assert delete_response.status_code == 204

    list_response = client.get("/api/summary-profiles")
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_update_profile_success(tmp_path: Path, monkeypatch) -> None:
    """
    Happy path: update an existing profile's model and prompt_template.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    client.post(
        "/api/summary-profiles",
        json={
            "name": "editable",
            "base_url": "https://api.example.com",
            "key": "k",
            "model": "gpt-4",
            "fields": ["title"],
            "prompt_template": "Old {{title}}",
        },
    )
    update_response = client.put(
        "/api/summary-profiles/editable",
        json={"model": "gpt-3.5", "prompt_template": "New {{title}}"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "editable"
    assert updated["model"] == "gpt-3.5"
    assert updated["prompt_template"] == "New {{title}}"


def test_get_profile_by_name(tmp_path: Path, monkeypatch) -> None:
    """
    Query: get a single profile by name returns 200 and the profile; nonexistent returns 404.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    client.post(
        "/api/summary-profiles",
        json={
            "name": "my-profile",
            "base_url": "https://api.example.com",
            "key": "key",
            "model": "gpt-4",
            "fields": ["title", "content"],
            "prompt_template": "Sum: {{title}}",
        },
    )

    get_response = client.get("/api/summary-profiles/my-profile")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["name"] == "my-profile"
    assert data["model"] == "gpt-4"

    not_found = client.get("/api/summary-profiles/nonexistent")
    assert not_found.status_code == 404


def test_update_profile_rename_to_existing_name_returns_409(tmp_path: Path, monkeypatch) -> None:
    """
    Boundary: renaming a profile to a name that already exists returns 409.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    client.post(
        "/api/summary-profiles",
        json={
            "name": "first",
            "base_url": "https://api.example.com",
            "key": "k",
            "model": "gpt-4",
            "fields": [],
            "prompt_template": "x",
        },
    )
    client.post(
        "/api/summary-profiles",
        json={
            "name": "second",
            "base_url": "https://api.example.com",
            "key": "k",
            "model": "gpt-4",
            "fields": [],
            "prompt_template": "y",
        },
    )

    response = client.put(
        "/api/summary-profiles/second",
        json={"name": "first"},
    )
    assert response.status_code == 409
    body = response.json()
    assert body.get("code") == "PROFILE_NAME_EXISTS"
    assert "details" in body
