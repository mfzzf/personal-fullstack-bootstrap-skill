#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: check_openapi_size.py <path-to-openapi.yaml>")
        return 1

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"ERROR: file not found: {path}")
        return 1

    if not path.is_file():
        print(f"ERROR: not a file: {path}")
        return 1

    line_count = len(path.read_text(encoding="utf-8").splitlines())
    print(f"{path}: {line_count} lines")

    if line_count >= 500:
        print("ERROR: OpenAPI YAML must be less than 500 lines")
        return 2

    print("OK: OpenAPI YAML is under the 500 line limit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
