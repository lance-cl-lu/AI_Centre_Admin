#!/usr/bin/env python3
"""
Quick helper script to verify the node-resource-monitor config API.

Usage:
    NODE_MONITOR_BASE=http://127.0.0.1:8000 python scripts/test_node_resource_monitor_config.py

If BACKEND is only reachable inside the cluster, run this inside the backend pod:
    kubectl exec -n ldap <backend-pod> -- \
      env NODE_MONITOR_BASE=http://localhost:8000 \
      python /code/scripts/test_node_resource_monitor_config.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    base = os.environ.get("NODE_MONITOR_BASE", "http://localhost:8000").rstrip("/")
    url = f"{base}/api/node-resource-monitor/config/"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = response.read().decode("utf-8")
            data = json.loads(payload)
            print(f"HTTP {response.status} {response.reason}")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return 0
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")
        print(f"HTTP {exc.code} {exc.reason}")
        if body:
            try:
                parsed = json.loads(body)
                print(json.dumps(parsed, indent=2, ensure_ascii=False))
            except json.JSONDecodeError:
                print(body)
        return 1
    except Exception as exc:  # pylint: disable=broad-except
        print(f"Request failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
