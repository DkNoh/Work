#!/usr/bin/env python3
"""격리된 dev JAR의 실제 OpenAPI와 snapshot을 비교한다. 갱신은 --update로만 한다."""
import argparse
import json
import pathlib
from _harness import ROOT, HttpClient, JarServer


SERVER_METADATA = [{"url": "/", "description": "같은 출처의 실행 서버"}]
MAX_REPORTED_CHANGES = 40


def changed_fields(expected, actual):
    """JSON 객체 키 순서는 무시하고 배열·필드 계약을 비교한다. 값은 반환하지 않는다."""
    changes = []

    def compare(left, right, path):
        if type(left) is not type(right):
            changes.append(("CHANGED", path + " (type)"))
        elif isinstance(left, dict):
            for key in sorted(left.keys() | right.keys()):
                field = path + "[" + repr(key) + "]"
                if key not in left:
                    changes.append(("ADDED", field))
                elif key not in right:
                    changes.append(("REMOVED", field))
                else:
                    compare(left[key], right[key], field)
        elif isinstance(left, list):
            if len(left) != len(right):
                changes.append(("CHANGED", path + " (array length)"))
            for index, (old_item, new_item) in enumerate(zip(left, right)):
                compare(old_item, new_item, f"{path}[{index}]")
        elif left != right:
            changes.append(("CHANGED", path))

    compare(expected, actual, "$root")
    return changes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", type=pathlib.Path, default=ROOT / "backend/reference-app/target/sc-reference-app.jar")
    parser.add_argument("--snapshot", type=pathlib.Path, default=ROOT / "docs/openapi.json")
    parser.add_argument("--update", action="store_true", help="실제 명세로 snapshot을 명시적으로 갱신한다. TS 타입은 별도로 재생성해야 한다.")
    parser.add_argument("--profile", choices=("dev", "dev,operations"), default="dev")
    parser.add_argument("--operations-home", type=pathlib.Path, help="운영 명세 검증에 사용하는 private 인프라 연결 secret 경로")
    args = parser.parse_args()
    snapshot = args.snapshot.resolve()
    server = None
    try:
        if args.profile == "dev,operations":
            from _operations_harness import operations_server
            application = "starter" if args.jar.name == "sc-starter-app.jar" else "reference"
            server = operations_server(application, management_port=18482, shared_home=args.operations_home)
            server.jar = args.jar.resolve()
        else:
            server = JarServer(args.jar, profile="dev")
        server.start()
        actual = HttpClient(server).request("/v3/api-docs")
        if not isinstance(actual, dict) or not isinstance(actual.get("paths"), dict):
            print("FAIL actual server did not return an OpenAPI JSON object with paths.")
            return 1
        # 환경별 포트·호스트만 제거한다. info/schema/operation/보안 계약은 그대로 비교한다.
        actual["servers"] = SERVER_METADATA
        if args.update:
            snapshot.parent.mkdir(parents=True, exist_ok=True)
            snapshot.write_text(json.dumps(actual, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            print("UPDATED OpenAPI snapshot from the isolated dev JAR. Regenerate and verify TS types separately.")
            return 0
        expected = json.loads(snapshot.read_text(encoding="utf-8"))
        if not isinstance(expected, dict):
            print("FAIL snapshot is not a JSON object.")
            return 1
        if expected == actual:
            print("PASS actual dev JAR OpenAPI matches snapshot; only server metadata was normalized.")
            return 0
        changes = changed_fields(expected, actual)
        print(f"FAIL actual JAR OpenAPI differs from snapshot: {len(changes)} changed fields.")
        for kind, path in changes[:MAX_REPORTED_CHANGES]:
            print(kind, path)
        if len(changes) > MAX_REPORTED_CHANGES:
            print(f"... {len(changes) - MAX_REPORTED_CHANGES} additional changed fields omitted.")
        print("Review the API change; use --update explicitly only after accepting it.")
        return 1
    except (OSError, ValueError, RuntimeError, AssertionError) as error:
        # 런타임 예외 메시지·HTTP 본문·인증 자료는 출력하지 않는다.
        print(f"FAIL live OpenAPI comparison could not complete ({type(error).__name__}). Check the JAR and snapshot paths.")
        return 1
    finally:
        if server is not None:
            server.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
