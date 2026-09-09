"""Exercise real CREATE/UPDATE admission without persisting Notebook changes."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--namespace", required=True)
    parser.add_argument("--notebook", required=True)
    parser.add_argument("--seconds", type=int, default=240)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    base = ["kubectl", "--request-timeout=10s", "-n", args.namespace]
    original = subprocess.run(
        [*base, "get", "notebook", args.notebook, "-o", "json"],
        check=True, capture_output=True, text=True, timeout=15,
    )
    notebook = json.loads(original.stdout)
    for field in ("uid", "resourceVersion", "creationTimestamp", "generation", "managedFields"):
        notebook["metadata"].pop(field, None)
    notebook.pop("status", None)
    notebook["metadata"]["name"] = f"groupshare-tls-check-{uuid.uuid4().hex[:8]}"
    patch = json.dumps({"metadata": {"annotations": {"ops.cgu.edu.tw/tls-check": "soak"}}})
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "namespace": args.namespace,
        "notebook": args.notebook,
        "create_passed": 0,
        "update_passed": 0,
        "failures": [],
    }
    deadline = time.monotonic() + args.seconds
    count = 0
    while time.monotonic() < deadline:
        operation = "create" if count % 2 == 0 else "update"
        command = (
            [*base, "create", "--dry-run=server", "-f", "-", "-o", "name"]
            if operation == "create" else
            [*base, "patch", "notebook", args.notebook, "--type=merge", "-p", patch,
             "--dry-run=server", "-o", "name"]
        )
        try:
            result = subprocess.run(
                command, input=json.dumps(notebook) if operation == "create" else None,
                capture_output=True, text=True, timeout=15,
            )
            if result.returncode:
                raise RuntimeError(result.stderr.strip())
            report[f"{operation}_passed"] += 1
        except (subprocess.TimeoutExpired, RuntimeError) as exc:
            report["failures"].append({
                "time": datetime.now(timezone.utc).isoformat(),
                "operation": operation, "error": str(exc),
            })
        count += 1
        if count % 20 == 0:
            print(f"requests={count} failures={len(report['failures'])}", flush=True)
        time.sleep(0.5)
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2), flush=True)
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
