import os
from pathlib import Path
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import yaml


@unittest.skipUnless(shutil.which("openssl"), "openssl is required for the TLS integration test")
class TLSProbeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.directory = Path(cls.temp.name)
        for name in ("old", "new"):
            subprocess.run(
                [
                    "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                    "-keyout", str(cls.directory / f"{name}.key"),
                    "-out", str(cls.directory / f"{name}.crt"),
                    "-days", "1", "-subj", "/CN=groupshare-webhook.kubeflow.svc",
                ],
                check=True, capture_output=True, timeout=15,
            )
        patch_path = Path(__file__).resolve().parents[2] / "deploy/webhook-tls-probes-patch.yaml"
        patch = yaml.safe_load(patch_path.read_text())
        probe = patch["spec"]["template"]["spec"]["containers"][0]["livenessProbe"]
        cls.command = [sys.executable, *probe["exec"]["command"][1:]]

    def setUp(self):
        self.context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        self.load_certificate("old")
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler)
        self.server.socket = self.context.wrap_socket(self.server.socket, server_side=True)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)

    def load_certificate(self, name):
        self.context.load_cert_chain(
            self.directory / f"{name}.crt", self.directory / f"{name}.key"
        )

    def probe(self, filename, keyfile="old.key"):
        return subprocess.run(
            self.command,
            env={
                **os.environ,
                "PORT": str(self.server.server_port),
                "TLS_CERT_FILE": str(self.directory / filename),
                "TLS_KEY_FILE": str(self.directory / keyfile),
            },
            capture_output=True, text=True, timeout=8,
        )

    def test_matching_certificate_is_healthy(self):
        result = self.probe("old.crt")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_renewal_requires_reload_then_recovers(self):
        result = self.probe("new.crt", "new.key")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("TLS certificate changed", result.stderr)
        self.load_certificate("new")
        result = self.probe("new.crt", "new.key")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_chain_compares_only_the_leaf(self):
        (self.directory / "chain.crt").write_text(
            (self.directory / "old.crt").read_text()
            + (self.directory / "new.crt").read_text()
        )
        result = self.probe("chain.crt")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_certificate_preserves_working_server(self):
        self.assertEqual(self.probe("missing.crt").returncode, 0)

    def test_invalid_certificate_preserves_working_server(self):
        (self.directory / "invalid.crt").write_text("invalid certificate")
        self.assertEqual(self.probe("invalid.crt").returncode, 0)

    def test_mismatched_key_preserves_working_server(self):
        self.assertEqual(self.probe("new.crt", "old.key").returncode, 0)

    def test_unreachable_server_fails(self):
        self.stop_server()
        self.assertNotEqual(self.probe("old.crt").returncode, 0)


if __name__ == "__main__":
    unittest.main()
