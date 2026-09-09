from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import tempfile
import threading
import unittest


SOURCE = Path(__file__).resolve().parents[2] / "webhook/tls_reload.py"
SPEC = importlib.util.spec_from_file_location("groupshare_tls_reload", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


@unittest.skipUnless(shutil.which("openssl"), "openssl is required")
class TLSReloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.certs = Path(cls.temp.name)
        cls.openssl(
            "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "3650",
            "-subj", "/CN=GroupShare Test CA", "-keyout", "ca.key", "-out", "ca.crt",
        )
        (cls.certs / "leaf.ext").write_text(
            "basicConstraints=critical,CA:FALSE\n"
            "keyUsage=critical,digitalSignature,keyEncipherment\n"
            "extendedKeyUsage=serverAuth\n"
            "subjectAltName=DNS:groupshare-webhook.kubeflow.svc\n"
        )
        for name in ("first", "second"):
            cls.openssl(
                "req", "-new", "-newkey", "rsa:2048", "-nodes",
                "-subj", "/CN=groupshare-webhook.kubeflow.svc",
                "-keyout", f"{name}.key", "-out", f"{name}.csr",
            )
            cls.openssl(
                "x509", "-req", "-in", f"{name}.csr", "-CA", "ca.crt",
                "-CAkey", "ca.key", "-CAcreateserial", "-days", "400",
                "-extfile", "leaf.ext", "-out", f"{name}.crt",
            )

    @classmethod
    def openssl(cls, *args):
        subprocess.run(
            ["openssl", *args], cwd=cls.certs, check=True,
            capture_output=True, timeout=15,
        )

    def setUp(self):
        self.mount_temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.mount_temp.cleanup)
        self.mount = Path(self.mount_temp.name)
        self.generation = 0
        self.project("first")
        self.reload = MODULE.ReloadingTLSContext(
            self.mount / "tls.crt", self.mount / "tls.key"
        )
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler)
        self.server.socket = self.reload.context.wrap_socket(
            self.server.socket, server_side=True
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)

    def project(self, certificate, key=None):
        self.generation += 1
        directory = self.mount / f"..version-{self.generation}"
        directory.mkdir()
        shutil.copy(self.certs / f"{certificate}.crt", directory / "tls.crt")
        shutil.copy(self.certs / f"{key or certificate}.key", directory / "tls.key")
        pending = self.mount / "..data-new"
        pending.symlink_to(directory.name)
        pending.replace(self.mount / "..data")
        for name in ("tls.crt", "tls.key"):
            if not (self.mount / name).is_symlink():
                (self.mount / name).symlink_to(f"..data/{name}")

    def handshake(self, sni=True):
        context = ssl.create_default_context(cafile=str(self.certs / "ca.crt"))
        if not sni:
            context.check_hostname = False
        with socket.create_connection(self.server.server_address, timeout=3) as sock:
            with context.wrap_socket(
                sock, server_hostname="groupshare-webhook.kubeflow.svc" if sni else None
            ) as tls:
                return tls.getpeercert(binary_form=True)

    def expected(self, name):
        return ssl.PEM_cert_to_DER_cert((self.certs / f"{name}.crt").read_text())

    def test_initial_certificate_is_trusted(self):
        self.assertEqual(self.handshake(), self.expected("first"))
        self.assertTrue(self.reload.healthy)

    def test_twelve_rotations_without_restarting_server(self):
        for index in range(12):
            name = "second" if index % 2 == 0 else "first"
            self.project(name)
            self.assertEqual(self.handshake(), self.expected(name))
            self.assertTrue(self.thread.is_alive())
        self.assertEqual(self.reload.reload_count, 13)

    def test_clients_without_sni_also_reload(self):
        self.project("second")
        self.assertEqual(self.handshake(sni=False), self.expected("second"))

    def test_mismatched_key_keeps_previous_valid_certificate(self):
        self.project("second", key="first")
        self.assertEqual(self.handshake(), self.expected("first"))
        self.assertFalse(self.reload.healthy)
        self.project("second")
        self.assertEqual(self.handshake(), self.expected("second"))
        self.assertTrue(self.reload.healthy)

    def test_missing_projection_keeps_previous_valid_certificate(self):
        (self.mount / "..data").unlink()
        self.assertEqual(self.handshake(), self.expected("first"))
        self.assertFalse(self.reload.healthy)
        self.project("second")
        self.assertEqual(self.handshake(), self.expected("second"))

    def test_concurrent_handshakes_load_one_complete_context(self):
        self.project("second")
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.handshake(), range(12)))
        self.assertEqual(results, [self.expected("second")] * 12)
        self.assertEqual(self.reload.reload_count, 2)

    def test_missing_initial_certificate_fails_startup(self):
        with self.assertRaises(RuntimeError):
            MODULE.ReloadingTLSContext(self.mount / "absent.crt", self.mount / "absent.key")
