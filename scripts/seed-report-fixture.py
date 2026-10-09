#!/usr/bin/env python3
"""신규 검증 H2에만 10k 합성 행을 넣는다. 생산 seed API/profile은 만들지 않는다."""
import datetime
import os
import pathlib
import re
import shutil
import subprocess
import zipfile

COUNT = 10_000
USER_A = 100_001
USER_B = 100_002
REVIEWER = 100_003
MENU_A = 200_001
MENU_B = 200_002
FIRST_REQUIREMENT = 1_000_001
STATUSES = (
    "DRAFT", "REQUESTED", "NEEDS_INFO", "REVIEWING", "AGREED",
    "REQUESTED", "NEEDS_INFO", "REVIEWING", "AGREED", "REQUESTED",
)


def sql_string(value):
    return "'" + value.replace("'", "''") + "'"


def java21():
    executable = os.environ.get("JAVA_BIN")
    if not executable:
        executable = str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java") if os.environ.get("JAVA21_HOME") else "java"
    result = subprocess.run([executable, "-version"], capture_output=True, text=True, check=True)
    if not re.search(r'version "21(?:\.|\")', result.stderr + result.stdout):
        raise RuntimeError("격리 H2 보고서 fixture에는 JDK21이 필요합니다.")
    return executable


def isolated_java(server, command):
    process = subprocess.Popen(command, cwd=server.folder, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    server.report_fixture_process = process
    try:
        stdout, stderr = process.communicate(timeout=120)
        if process.returncode:
            # H2 오류에는 실행 SQL이 포함된다. 원문 대신 숫자 H2 error code만 외부에 알린다.
            codes = sorted(set(re.findall(r"\[(\d{5})-\d+\]", stderr + stdout)))
            diagnostic = ",".join(codes[:5]) or "UNKNOWN"
            raise RuntimeError(f"격리 H2 fixture 명령이 실패했습니다(exit={process.returncode}, H2ErrorCode={diagnostic}).")
        return stdout
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        server.report_fixture_process = None


def seed_report_fixture(server):
    """JarServer가 소유한 새 자료에 offline INSERT 후 공개 기대 데이터만 반환한다."""
    folder = server.folder.resolve()
    if server.process is not None:
        raise RuntimeError("H2 offline seed 전에 검증 JAR를 정지해야 합니다.")
    if server.start_count != 1 or not folder.name.startswith("sc-framework-test-"):
        raise RuntimeError("새 JarServer가 한 번 bootstrap한 자료만 seed할 수 있습니다.")
    database = folder / "data/test.mv.db"
    if not database.is_file() or database.is_symlink() or not server.secret.is_file():
        raise RuntimeError("소유한 신규 H2/secret 파일이 없습니다.")
    extraction = folder / "report-fixture"
    extraction.mkdir(mode=0o700)
    try:
        with zipfile.ZipFile(server.jar) as archive:
            names = [name for name in archive.namelist() if re.fullmatch(r"BOOT-INF/lib/h2-[0-9.]+\.jar", name)]
            if len(names) != 1:
                raise RuntimeError("실제 JAR에서 H2 runtime library 하나를 확인해야 합니다.")
            h2 = extraction / pathlib.PurePosixPath(names[0]).name
            h2.write_bytes(archive.read(names[0]))
        epoch = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
        executable = java21()
        database_args = ["-url", f"jdbc:h2:file:{folder / 'data/test'};DB_CLOSE_ON_EXIT=FALSE", "-user", "sa", "-password", ""]
        precondition = "SELECT CONCAT((SELECT COUNT(*) FROM reference_user),'/',(SELECT COUNT(*) FROM reference_user WHERE username='admin' AND role='ADMIN'),'/',(SELECT COUNT(*) FROM requirement_entry),'/',(SELECT COUNT(*) FROM menu_entry)) AS FIXTURE_PRECONDITIONS;"
        before = isolated_java(server, [executable, "-cp", str(h2), "org.h2.tools.Shell", *database_args, "-sql", precondition])
        if not re.search(r"(?m)^1/1/0/0\s*$", before):
            raise RuntimeError("보고서 seed는 새 bootstrap 사용자만 있는 빈 업무 DB에서 실행해야 합니다.")
        sql = ["SET AUTOCOMMIT FALSE;"]
        actors = [(USER_A, "report-author-a", "Report author A", "REQUESTER"), (USER_B, "report-author-b", "Report author B", "REQUESTER"), (REVIEWER, "report-reviewer", "Report reviewer", "REVIEWER")]
        # 명시 high-ID는 bootstrap/향후 소수 HTTP identity INSERT 범위와 겹치지 않는다.
        # 보고서 E2E는 이 DB에 추가 업무 INSERT를 하지 않고 일반 E2E DB와도 분리한다.
        for identifier, username, display_name, role in actors:
            # 검증용 bootstrap hash만 DB 내부에서 복사한다. 평문/hash를 추출하거나 로그에 쓰지 않는다.
            sql.append(f"INSERT INTO reference_user(id,username,display_name,password_hash,role,created_at) SELECT {identifier},{sql_string(username)},{sql_string(display_name)},password_hash,{sql_string(role)},TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+00' FROM reference_user WHERE username='admin';")
        for identifier, name, order in [(MENU_A, "Report menu A", 0), (MENU_B, "Report menu B", 1)]:
            sql.append(f"INSERT INTO menu_entry(id,parent_id,name,sort_order,active) VALUES({identifier},NULL,{sql_string(name)},{order},1);")
        rows = []
        history_id = 3_000_001
        comment_id = 4_000_001
        for index in range(COUNT):
            identifier = FIRST_REQUIREMENT + index
            title = ("literal % _ \\ ' 한국 보고서 " if index % 1000 == 0 else "보고서 합성 행 ") + f"{index:05d}"
            status = STATUSES[index % len(STATUSES)]
            author = USER_A if index % 20 < 10 else USER_B
            menu = MENU_A if index % 3 == 0 else MENU_B
            updated = epoch + datetime.timedelta(seconds=index // 3)
            timestamp = updated.isoformat().replace("T", " ").replace("+00:00", "+00")
            reviewer = None if status == "DRAFT" else REVIEWER
            sql.append("INSERT INTO requirement_entry(id,menu_id,title,desired,reason,reference_text,similar,follow_parts,screen_version_id,status,revision,command_sequence,author_id,assigned_reviewer_id,created_at,updated_at) VALUES(" + f"{identifier},{menu},{sql_string(title)},'Synthetic report desired','Synthetic report reason','',{index % 2},'',NULL,{sql_string(status)},1,0,{author},{reviewer or 'NULL'},TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+00',TIMESTAMP WITH TIME ZONE {sql_string(timestamp)});")
            history_count = 0 if index == 0 else 4 if index % 7 == 3 else 1
            for number in range(history_count):
                action = "CREATE" if number == 0 else "EDIT"
                sql.append(f"INSERT INTO requirement_history(id,requirement_id,action,before_json,after_json,actor_id,created_at) VALUES({history_id},{identifier},{sql_string(action)},NULL,'{{}}',{author},TIMESTAMP WITH TIME ZONE {sql_string(timestamp)});")
                history_id += 1
            comment_count = index % 4
            last_comment = None
            for number in range(comment_count):
                comment_time = updated + datetime.timedelta(seconds=number + 1)
                last_comment = comment_time.isoformat().replace("+00:00", "Z")
                comment_timestamp = comment_time.isoformat().replace("T", " ").replace("+00:00", "+00")
                sql.append(f"INSERT INTO requirement_comment(id,requirement_id,body,author_id,created_at) VALUES({comment_id},{identifier},'Synthetic report comment {number}',{author},TIMESTAMP WITH TIME ZONE {sql_string(comment_timestamp)});")
                comment_id += 1
            if status in ("REVIEWING", "AGREED"):
                decision = "POSSIBLE" if status == "AGREED" else "CONDITIONAL"
                sql.append(f"INSERT INTO requirement_review(requirement_id,decision,rationale,conditions,scope,exclusions,acceptance,estimate,reviewer_id,updated_at) VALUES({identifier},{sql_string(decision)},'Synthetic review','','Synthetic scope','Synthetic exclusions','Synthetic acceptance','SMALL',{REVIEWER},TIMESTAMP WITH TIME ZONE {sql_string(timestamp)});")
            rows.append({"id": identifier, "title": title, "menuId": menu, "authorId": author, "status": status, "updatedAt": updated.isoformat().replace("+00:00", "Z"), "commentCount": comment_count, "historyCount": history_count, "lastCommentAt": last_comment, "assignedReviewerId": reviewer, "reviewDecision": "POSSIBLE" if status == "AGREED" else "CONDITIONAL" if status == "REVIEWING" else None})
        sql.append("COMMIT;")
        script = extraction / "seed.sql"
        script.write_text("\n".join(sql) + "\n", encoding="utf-8")
        # 실제 H2 2.3 RunScript CLI는 -charset 대신 RUNSCRIPT -options를 받는다.
        command = [executable, "-cp", str(h2), "org.h2.tools.RunScript", *database_args, "-script", str(script), "-options", "CHARSET 'UTF-8'"]
        isolated_java(server, command)
        counts = "SELECT CONCAT((SELECT COUNT(*) FROM requirement_entry),'/',(SELECT COUNT(*) FROM requirement_history),'/',(SELECT COUNT(*) FROM requirement_comment)) AS FIXTURE_COUNTS;"
        after = isolated_java(server, [executable, "-cp", str(h2), "org.h2.tools.Shell", *database_args, "-sql", counts])
        if not re.search(r"(?m)^10000/14286/15000\s*$", after):
            raise RuntimeError("보고서 fixture의 실제 INSERT 수를 확인하지 못했습니다.")
        return {"rows": rows, "count": COUNT, "authorA": USER_A, "authorB": USER_B, "reviewer": REVIEWER, "menuA": MENU_A, "menuB": MENU_B, "usernameA": "report-author-a", "usernameB": "report-author-b", "menuNameA": "Report menu A", "menuNameB": "Report menu B", "firstRequirementId": FIRST_REQUIREMENT, "h2RuntimeLibrary": h2.name}
    finally:
        shutil.rmtree(extraction)
