import importlib
import os
import pytest
from fastapi.testclient import TestClient


def make_client(debug_value: str):
    os.environ["DEBUG"] = debug_value
    import main
    importlib.reload(main)
    return TestClient(main.app)


def test_swagger_available_in_debug():
    client = make_client("true")
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200


def test_swagger_hidden_in_production():
    client = make_client("false")
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
