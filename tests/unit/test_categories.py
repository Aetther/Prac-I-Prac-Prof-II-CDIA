from app.categories import (
    CATEGORIES,
    find_category_by_name,
    get_category_descriptions,
    get_category_labels,
    get_category_names,
)
from app.load_data import CATEGORY_MAP


def test_there_are_six_categories():
    assert len(CATEGORIES) == 6


def test_every_category_has_required_keys():
    for category in CATEGORIES:
        assert {"name", "label", "description"} <= category.keys()
        assert all(category[key].strip() for key in ("name", "label", "description"))


def test_names_are_unique():
    names = get_category_names()
    assert len(names) == len(set(names))


def test_helpers_keep_the_same_order():
    names = get_category_names()
    labels = get_category_labels()
    descriptions = get_category_descriptions()
    for i, category in enumerate(CATEGORIES):
        assert names[i] == category["name"]
        assert labels[i] == category["label"]
        assert descriptions[i] == category["description"]


def test_find_category_by_name():
    category = find_category_by_name("arte")
    assert category is not None
    assert category["label"] == "Arte"

    assert find_category_by_name("inexistente") is None


def test_labels_match_the_categories_used_when_loading_data():
    # Si no coinciden, la comparación con la categoría del dataset se rompe
    assert set(get_category_labels()) == set(CATEGORY_MAP.values())