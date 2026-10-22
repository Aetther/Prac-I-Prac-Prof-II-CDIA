"""
Límite de pedidos por IP, en memoria ("ventana deslizante").

Para cada IP guarda los momentos de sus últimos pedidos. Un pedido nuevo pasa
si en los últimos `window_seconds` segundos hubo menos de `max_requests`.

Limitaciones:
- El contador vive en la memoria del proceso: se reinicia al reiniciar la
  API, y si se corren varios procesos, cada uno cuenta por su lado.
- Detrás de un proxy (por ejemplo, nginx), todos los pedidos llegan con la IP
  del proxy: hay que configurarlo para que pase la IP real del cliente.
"""
import math
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

# Si hay más IPs anotadas que esto, se borran las que no tienen pedidos recientes
MAX_TRACKED_KEYS = 10_000


class RateLimiter:
    def __init__(
        self,
        max_requests: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # time.monotonic no salta si cambia la hora de la computadora;
        # en los tests se reemplaza por un reloj falso
        self.clock = clock
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()  # pedidos simultáneos no se pisan

    def _forget_old(self, hits: deque[float], now: float) -> None:
        """Descarta los pedidos que ya salieron de la ventana."""
        while hits and now - hits[0] >= self.window_seconds:
            hits.popleft()

    def _cleanup(self, now: float) -> None:
        """Borra las IPs sin pedidos recientes (para no acumular memoria)."""
        for key in list(self._hits):
            hits = self._hits[key]
            self._forget_old(hits, now)
            if not hits:
                del self._hits[key]

    def allow(self, key: str) -> bool:
        """True si el pedido de `key` puede pasar (y lo anota); False si no."""
        now = self.clock()
        with self._lock:
            if len(self._hits) > MAX_TRACKED_KEYS:
                self._cleanup(now)
            hits = self._hits[key]
            self._forget_old(hits, now)
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            return True

    def retry_after(self, key: str) -> int:
        """Segundos que faltan para que `key` pueda volver a pedir (0 si ya puede)."""
        now = self.clock()
        with self._lock:
            hits = self._hits.get(key)
            if not hits or len(hits) < self.max_requests:
                return 0
            return max(1, math.ceil(hits[0] + self.window_seconds - now))

    def reset(self) -> None:
        """Olvida todo (para los tests)."""
        with self._lock:
            self._hits.clear()