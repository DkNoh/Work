#!/usr/bin/env python3
"""합성 계정으로 reference/starter JAR와 파일형 H2 재시작을 실제 HTTP 검증한다."""
import argparse
import secrets
from _harness import ROOT, HttpClient, JarServer

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--jar", default=ROOT / "backend/reference-app/target/sc-reference-app.jar")
parser.add_argument("--starter-jar", default=ROOT / "backend/starter-app/target/sc-starter-app.jar")
parser.add_argument("--keep", action="store_true", help="합성 DB/로그만 보관; 비밀번호 파일은 삭제")
args = parser.parse_args()
server = JarServer(args.jar)
checks = 0


def check(condition, message):
    global checks
    if not condition:
        raise AssertionError(message)
    checks += 1
    print("PASS", message, flush=True)


try:
    server.start()
    anonymous = HttpClient(server)
    check(anonymous.request("/api/health")["status"] == "UP", "public health")
    check(b'id="app"' in anonymous.request("/examples"), "Vue SPA is packaged in reference JAR")
    anonymous.request("/api/examples", expected=401)
    owner = HttpClient(server)
    owner.login()
    identity = owner.request("/api/auth/me")
    check(set(identity) == {"id", "username", "displayName", "role"}
          and identity["username"] == "admin" and identity["role"] == "ADMIN"
          and type(identity["id"]) is int and identity["id"] > 0, "Reference DB identity contract")
    check(b'id="app"' in owner.request("/requests")
          and b'id="app"' in owner.request("/workspace"), "requirements routes are packaged in JAR")
    owner.request("/api/examples", "POST", {"title": "CSRF 없이 저장"}, expected=403, csrf=False)
    created = owner.request("/api/examples", "POST", {"title": "파일형 H2 재시작 검증"}, expected=201)
    path = f"/api/examples/{created['id']}"
    updated = owner.request(path, "PUT", {"title": "변경된 제목", "revision": created["revision"]})
    check(updated["revision"] == created["revision"] + 1, "JPA save advances revision")
    rejected = owner.request(path, "PUT", {"title": "오래된 변경", "revision": created["revision"]}, expected=409)
    check(rejected["code"] == "REVISION_CONFLICT", "stale revision is rejected")
    listing = owner.request("/api/examples?page=0&size=10")
    check(any(row == updated for row in listing["items"]), "list returns the saved row")
    reviewer_password = secrets.token_urlsafe(24)
    reviewer = owner.request("/api/users", "POST", {
        "username": "reopen-reviewer", "password": reviewer_password,
        "displayName": "재기동 검토자", "role": "REVIEWER",
    })
    menu = owner.request("/api/menus", "POST", {
        "parentId": None, "name": "재기동 업무 메뉴", "sortOrder": 0,
    })
    requirement = owner.request("/api/requirements", "POST", {
        "title": "재기동 요구사항", "menuId": menu["id"], "desired": "조회\n저장 확인",
        "reason": "자료 보존", "referenceText": "", "similar": False, "followParts": "",
        "screenVersionId": None, "annotation": None, "revision": 1,
    })
    requirement_path = f"/api/requirements/{requirement['id']}"
    assigned = owner.request(requirement_path + "/assignee", "PUT", {
        "revision": requirement["revision"], "reviewerId": reviewer["id"],
    })
    check(assigned["assignedReviewerId"] == reviewer["id"] and assigned["revision"] == 2,
          "DB user and requirement assignment are stored")
    # 동일 임시 DB를 정상 종료 후 다시 열어 인메모리 테스트가 놓치는 지속성을 확인한다.
    server.stop()
    check((server.folder / "data/test.mv.db").is_file(), "H2 persistent file exists")
    # 새 임시 secret의 변경이 기존 DB 관리자의 암호를 덮어쓰면 안 된다.
    server.secret.write_text(secrets.token_urlsafe(24))
    server.start()
    owner = HttpClient(server)
    owner.login()
    listing = owner.request("/api/examples?page=0&size=10")
    check(any(row == updated for row in listing["items"]), "title and revision survive JAR restart")
    check(owner.request("/api/auth/me") == identity, "bootstrap does not replace persisted DB identity")
    persisted = owner.request(requirement_path)
    check(persisted == assigned, "requirement revision, assignment, timestamps and history survive restart")
    other = HttpClient(server)
    other.request("/api/auth/login", "POST", {
        "username": reviewer["username"], "password": reviewer_password,
    }, expected=204, form=True)
    check(other.request("/api/auth/me") == reviewer, "created DB user authenticates after restart")
    audit = owner.request("/api/audit/events?action=REQUIREMENT_ASSIGN")
    check(any(row["outcome"] == "SUCCESS" and row["resourceId"] == str(requirement["id"])
              for row in audit["items"]), "committed security audit survives restart")
    owner.request("/api/auth/logout", "POST", expected=204)
    owner.request("/api/auth/me", expected=401)
    check(True, "logout clears the session")
finally:
    server.cleanup(keep=args.keep)

starter = JarServer(args.starter_jar)
try:
    starter.start()
    public = HttpClient(starter)
    health = public.request("/api/health")
    check(health.get("application") == "sc-starter-app", "independent Starter JAR starts")
    check(b'id="app"' in public.request("/"), "minimal Vue consumer is packaged in Starter JAR")
finally:
    starter.cleanup(keep=args.keep)
print(f"{checks} isolated HTTP checks passed.")
