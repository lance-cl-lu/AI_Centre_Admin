"""Reload complete TLS contexts when Kubernetes projects a new Secret version."""

import logging
from pathlib import Path
import ssl
import threading


logger = logging.getLogger("groupshare-webhook.tls")


class ReloadingTLSContext:
    def __init__(self, cert_file, key_file):
        self.cert_file = Path(cert_file)
        self.key_file = Path(key_file)
        self._lock = threading.Lock()
        self._version = None
        self._current = None
        self._last_error = None
        self.reload_count = 0
        self.healthy = False
        self.context = self.current()
        if self.context is None:
            raise RuntimeError("No valid TLS certificate and key available at startup")
        self.context.sni_callback = self._select_context

    def _snapshot(self):
        # Resolve ..data once so certificate and key come from one atomic projection.
        if self.cert_file.parent == self.key_file.parent:
            data = self.cert_file.parent / "..data"
            if data.is_symlink():
                directory = data.resolve(strict=True)
                cert = directory / self.cert_file.name
                key = directory / self.key_file.name
            else:
                cert, key = self.cert_file, self.key_file
        else:
            cert, key = self.cert_file, self.key_file
        version = tuple(
            (str(path), stat.st_ino, stat.st_size, stat.st_mtime_ns)
            for path in (cert, key)
            for stat in (path.stat(),)
        )
        return cert, key, version

    def current(self):
        with self._lock:
            try:
                cert, key, version = self._snapshot()
                if version != self._version:
                    candidate = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                    candidate.minimum_version = ssl.TLSVersion.TLSv1_2
                    candidate.load_cert_chain(cert, key)
                    # Never replace a working context with a partial or invalid key pair.
                    self._current = candidate
                    self._version = version
                    self.reload_count += 1
                    logger.info("TLS certificate loaded successfully (generation %d)", self.reload_count)
                self.healthy = True
                self._last_error = None
            except (OSError, ssl.SSLError) as exc:
                self.healthy = False
                error = str(exc)
                if error != self._last_error:
                    logger.error("TLS reload failed; retaining the last valid context: %s", error)
                    self._last_error = error
            return self._current

    def _select_context(self, socket, server_name, initial_context):
        socket.context = self.current()

