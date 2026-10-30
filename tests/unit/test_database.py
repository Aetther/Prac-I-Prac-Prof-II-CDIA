"""Cómo se arma la dirección de la base: DATABASE_URL o las variables POSTGRES_*."""
import pytest

from app.database import database_url

POSTGRES_VARS = ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB")


@pytest.fixture
def env(monkeypatch):
    """Arranca sin ninguna variable de la base, para que el .env no influya."""
    for name in ("DATABASE_URL", *POSTGRES_VARS):
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_without_database_url_uses_the_postgres_variables(env):
    env.setenv("POSTGRES_USER", "ana")
    env.setenv("POSTGRES_PASSWORD", "secreta")
    env.setenv("POSTGRES_HOST", "db.local")
    env.setenv("POSTGRES_PORT", "5433")
    env.setenv("POSTGRES_DB", "trivia")
    url = database_url()
    assert url.drivername == "postgresql+psycopg2"
    assert (url.username, url.password, url.host, url.port, url.database) == (
        "ana", "secreta", "db.local", 5433, "trivia",
    )


def test_without_any_variable_uses_the_defaults(env):
    url = database_url()
    assert (url.username, url.host, url.port, url.database) == ("admin", "127.0.0.1", 5432, "questions_db")


@pytest.mark.parametrize("scheme", ["postgresql", "postgres", "postgresql+psycopg2"])
def test_database_url_wins_and_uses_psycopg2(env, scheme):
    env.setenv("POSTGRES_HOST", "no-se-usa")
    env.setenv("DATABASE_URL", f"{scheme}://u:p@ep-algo.neon.tech/trivia?sslmode=require")
    url = database_url()
    assert url.drivername == "postgresql+psycopg2"
    assert url.host == "ep-algo.neon.tech"
    assert url.database == "trivia"
    assert url.query["sslmode"] == "require"


def test_blank_database_url_is_ignored(env):
    env.setenv("DATABASE_URL", "   ")
    env.setenv("POSTGRES_HOST", "db.local")
    assert database_url().host == "db.local"
