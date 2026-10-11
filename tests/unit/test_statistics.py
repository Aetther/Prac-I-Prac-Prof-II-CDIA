import pytest

from app.review_automatic import wilson_interval


def test_perfect_score_has_a_lower_bound_below_100():
    low, high = wilson_interval(60, 60)
    assert low == pytest.approx(0.9398, abs=1e-3)
    assert high == pytest.approx(1.0)


def test_zero_successes():
    low, high = wilson_interval(0, 10)
    assert low == pytest.approx(0.0)
    assert high > 0


def test_interval_is_symmetric_at_50_percent():
    low, high = wilson_interval(50, 100)
    assert 0.5 - low == pytest.approx(high - 0.5)


def test_interval_always_contains_the_measured_proportion():
    for successes in range(0, 21):
        low, high = wilson_interval(successes, 20)
        assert 0.0 <= low <= successes / 20 <= high <= 1.0