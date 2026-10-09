#!/usr/bin/env python3
"""중립 호환 명세에는 Starter에서 실제 캡처한 운영 API와 참조 schema만 추가한다."""
import argparse
import copy
import json
from _harness import ROOT


def references(value):
    if isinstance(value, dict):
        ref = value.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
            yield ref.rsplit("/", 1)[1]
        for child in value.values():
            yield from references(child)
    elif isinstance(value, list):
        for child in value:
            yield from references(child)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    path = ROOT / "docs/openapi-neutral.json"
    original = json.loads(path.read_text())
    result = copy.deepcopy(original)
    source = json.loads((ROOT / "docs/openapi-starter.json").read_text())
    paths = {name: value for name, value in source["paths"].items()
             if name.startswith("/api/operations/") or name == "/api/framework/capabilities"}
    needed = set(references(paths))
    pending = list(needed)
    while pending:
        name = pending.pop()
        for ref in references(source["components"]["schemas"][name]):
            if ref not in needed:
                needed.add(ref)
                pending.append(ref)
    result["paths"].update(paths)
    result["components"]["schemas"].update({name: source["components"]["schemas"][name] for name in needed})
    ids = [operation["operationId"] for item in result["paths"].values()
           for method, operation in item.items() if method in {"get", "post", "put", "delete", "patch", "head", "options"}
           and "operationId" in operation]
    if len(ids) != len(set(ids)):
        raise ValueError("Neutral OpenAPI operationId collision")
    if args.check:
        if original != result:
            raise ValueError("Neutral operations contracts differ from the actual Starter snapshot")
        print("PASS neutral operations paths and referenced schemas match the live Starter snapshot")
    else:
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
        print(f"UPDATED neutral contracts: {len(paths)} actual paths, {len(needed)} referenced schemas")


if __name__ == "__main__":
    main()
