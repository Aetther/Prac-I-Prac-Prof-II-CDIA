"""Versiones fijas de los modelos de Hugging Face (app/model_versions.py)."""
import re

import pytest

from app.model_versions import MODEL_REVISIONS, get_revision


def test_revisions_are_full_commits():
    # Un commit completo tiene 40 caracteres hexadecimales.
    # Un nombre de rama como "main" no sirve: puede cambiar.
    for model, revision in MODEL_REVISIONS.items():
        assert re.fullmatch(r"[0-9a-f]{40}", revision), model


def test_known_model_returns_its_revision():
    model = "MoritzLaurer/deberta-v3-large-zeroshot-v2.0"
    assert get_revision(model) == MODEL_REVISIONS[model]


def test_unknown_model_warns_and_uses_latest(capsys):
    assert get_revision("autor/modelo-nuevo") is None
    assert "no tiene versión fija" in capsys.readouterr().out


@pytest.mark.parametrize("module, constant", [
    ("app.classifier", "DEFAULT_MODEL"),
    ("app.cosine_classifier", "EMBEDDING_MODEL"),
    ("app.train_classifier", "EMBEDDING_MODEL"),
    ("app.train_setfit", "BASE_MODEL"),
    ("app.translator", "TRANSLATION_MODEL"),
])
def test_project_models_have_fixed_revision(module, constant):
    # Si alguien cambia un modelo del proyecto, este test le recuerda
    # que también tiene que fijar su versión en app/model_versions.py.
    # importorskip: si faltan las librerías de IA, se saltea en vez de fallar.
    model_name = getattr(pytest.importorskip(module), constant)
    assert model_name in MODEL_REVISIONS