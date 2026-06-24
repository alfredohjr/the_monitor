import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User
from auth import hash_password


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def override():
        return session

    app.dependency_overrides[get_session] = override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_register_creates_user(client: TestClient, session: Session):
    response = client.post("/api/v1/register/", json={"username": "novo", "password": "senha123"})
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "novo"
    assert "id" in data
    assert "hashed_password" not in data


def test_register_duplicate_username(client: TestClient, session: Session):
    session.add(User(username="existente", hashed_password=hash_password("abc")))
    session.commit()
    response = client.post("/api/v1/register/", json={"username": "existente", "password": "outra"})
    assert response.status_code == 400


def test_register_missing_fields(client: TestClient):
    response = client.post("/api/v1/register/", json={"username": "incompleto"})
    assert response.status_code == 422
