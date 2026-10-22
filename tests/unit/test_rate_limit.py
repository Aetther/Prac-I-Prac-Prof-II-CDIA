"""Límite de pedidos por IP (sin la API ni la base)."""
from app import rate_limit
from app.rate_limit import RateLimiter


class FakeClock:
    """Reloj que avanza solo cuando el test lo pide."""

    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def make_limiter(max_requests=3, window=60):
    clock = FakeClock()
    return RateLimiter(max_requests, window, clock=clock), clock


def test_allows_up_to_the_limit():
    limiter, _ = make_limiter()
    assert [limiter.allow("1.1.1.1") for _ in range(4)] == [True, True, True, False]


def test_each_ip_has_its_own_limit():
    limiter, _ = make_limiter()
    for _ in range(3):
        limiter.allow("1.1.1.1")
    assert limiter.allow("1.1.1.1") is False
    assert limiter.allow("2.2.2.2") is True  # otra IP no se ve afectada


def test_window_slides():
    limiter, clock = make_limiter()
    limiter.allow("ip")       # t = 0
    clock.advance(30)
    limiter.allow("ip")       # t = 30
    limiter.allow("ip")       # t = 30
    assert limiter.allow("ip") is False
    clock.advance(30)         # t = 60: el de t = 0 sale de la ventana
    assert limiter.allow("ip") is True
    assert limiter.allow("ip") is False  # los de t = 30 siguen adentro


def test_rejected_requests_do_not_count():
    limiter, clock = make_limiter()
    for _ in range(3):
        limiter.allow("ip")
    for _ in range(10):
        limiter.allow("ip")   # rechazados: no alargan la espera
    clock.advance(60)
    assert limiter.allow("ip") is True


def test_retry_after():
    limiter, clock = make_limiter()
    assert limiter.retry_after("ip") == 0  # sin pedidos, puede pedir ya
    for _ in range(3):
        limiter.allow("ip")
    assert limiter.retry_after("ip") == 60
    clock.advance(45.5)
    assert limiter.retry_after("ip") == 15  # se redondea para arriba


def test_reset_forgets_everything():
    limiter, _ = make_limiter()
    for _ in range(3):
        limiter.allow("ip")
    limiter.reset()
    assert limiter.allow("ip") is True


def test_old_ips_are_cleaned_up(monkeypatch):
    monkeypatch.setattr(rate_limit, "MAX_TRACKED_KEYS", 5)
    limiter, clock = make_limiter()
    for i in range(6):
        limiter.allow(f"ip-{i}")
    clock.advance(61)          # todas quedan viejas
    limiter.allow("nueva")     # supera el máximo: limpia
    assert set(limiter._hits) == {"nueva"}