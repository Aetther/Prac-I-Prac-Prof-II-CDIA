"""
Token de respuesta del juego.

GET /game/question entrega un token con cada pregunta y POST /game/answer lo
exige: así la respuesta correcta solo se revela para preguntas que se
sirvieron en una partida, y no recorriendo ids.

Formato: "<vencimiento>.<firma>". El vencimiento es la hora Unix en que deja
de valer y la firma es un HMAC-SHA256 del id de la pregunta y del
vencimiento, con un secreto (ANSWER_TOKEN_SECRET). No se guarda nada: cualquier
instancia de la API con el mismo secreto puede verificarlo.
"""
import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import time

# Tiempo para responder: alcanza de sobra para los 30 segundos de la
# dificultad más fácil, más la carga de la pregunta
TOKEN_TTL_SECONDS = 300

_EXPIRES = re.compile(r"[0-9]{1,12}")
_secret: bytes | None = None


def get_secret() -> bytes:
    """
    El secreto de ANSWER_TOKEN_SECRET. Si falta (en local o en los tests),
    se genera uno al azar al arrancar: sirve para un solo proceso, así que en
    un servidor con varias instancias (Vercel) la variable es obligatoria.
    """
    global _secret
    if _secret is None:
        value = (os.getenv("ANSWER_TOKEN_SECRET") or "").strip()
        if value:
            _secret = value.encode()
        else:
            logging.getLogger(__name__).warning(
                "Falta ANSWER_TOKEN_SECRET: se usa un secreto al azar, válido "
                "solo para este proceso"
            )
            _secret = secrets.token_bytes(32)
    return _secret


def _sign(secret: bytes, question_id: int, expires: int) -> str:
    message = f"{question_id}.{expires}".encode()
    digest = hmac.new(secret, message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def issue_token(
    question_id: int, now: float | None = None, secret: bytes | None = None
) -> str:
    """Token para responder la pregunta `question_id` durante TOKEN_TTL_SECONDS."""
    current = time.time() if now is None else now
    expires = int(current) + TOKEN_TTL_SECONDS
    return f"{expires}.{_sign(secret or get_secret(), question_id, expires)}"


def verify_token(
    token: str,
    question_id: int,
    now: float | None = None,
    secret: bytes | None = None,
) -> bool:
    """True si el token es de esta pregunta, no fue alterado y no venció."""
    expires_text, separator, signature = token.partition(".")
    if not separator or not _EXPIRES.fullmatch(expires_text):
        return False
    expires = int(expires_text)
    current = time.time() if now is None else now
    if current > expires:
        return False
    expected = _sign(secret or get_secret(), question_id, expires)
    # compare_digest tarda lo mismo acierte o no: no da pistas sobre la firma
    return hmac.compare_digest(signature.encode(), expected.encode())
