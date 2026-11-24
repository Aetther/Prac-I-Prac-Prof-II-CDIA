"""Tests del token de respuesta del juego (app/answer_token.py)."""
import pytest

import app.answer_token as answer_token
from app.answer_token import TOKEN_TTL_SECONDS, issue_token, verify_token

SECRET = b"secreto-de-prueba"
NOW = 1_800_000_000


def test_valid_token():
    token = issue_token(7, now=NOW, secret=SECRET)
    assert verify_token(token, 7, now=NOW, secret=SECRET)


def test_token_format():
    expires, _, signature = issue_token(7, now=NOW, secret=SECRET).partition(".")
    assert expires == str(NOW + TOKEN_TTL_SECONDS)
    assert signature and "=" not in signature


def test_token_of_another_question():
    token = issue_token(7, now=NOW, secret=SECRET)
    assert not verify_token(token, 8, now=NOW, secret=SECRET)


def test_token_with_another_secret():
    token = issue_token(7, now=NOW, secret=SECRET)
    assert not verify_token(token, 7, now=NOW, secret=b"otro-secreto")


def test_token_valid_until_it_expires():
    token = issue_token(7, now=NOW, secret=SECRET)
    last_second = NOW + TOKEN_TTL_SECONDS
    assert verify_token(token, 7, now=last_second, secret=SECRET)
    assert not verify_token(token, 7, now=last_second + 1, secret=SECRET)


def test_extending_the_expiry_breaks_the_signature():
    token = issue_token(7, now=NOW, secret=SECRET)
    _, _, signature = token.partition(".")
    forged = f"{NOW + 10 * TOKEN_TTL_SECONDS}.{signature}"
    assert not verify_token(forged, 7, now=NOW, secret=SECRET)


@pytest.mark.parametrize("token", [
    "", "sin-punto", ".firma", "abc.firma", "-5.firma", "1e9.firma",
    "1234567890123.firma",
])
def test_malformed_tokens(token):
    assert not verify_token(token, 7, now=NOW, secret=SECRET)


def test_secret_from_environment(monkeypatch):
    monkeypatch.setattr(answer_token, "_secret", None)
    monkeypatch.setenv("ANSWER_TOKEN_SECRET", "  desde-el-entorno  ")
    assert answer_token.get_secret() == b"desde-el-entorno"


def test_random_secret_without_environment(monkeypatch, caplog):
    monkeypatch.setattr(answer_token, "_secret", None)
    monkeypatch.delenv("ANSWER_TOKEN_SECRET", raising=False)
    secret = answer_token.get_secret()
    assert len(secret) == 32
    assert answer_token.get_secret() is secret
    assert "ANSWER_TOKEN_SECRET" in caplog.text
