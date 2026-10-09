#!/usr/bin/env python3
"""격리 Maven fixture로 부모 POM의 Java annotation processor 성공·실패 계약을 검증한다."""

import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import shlex
import signal
import subprocess
import tempfile
import textwrap
import time
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape


ROOT = pathlib.Path(__file__).resolve().parents[1]
MAVEN_NAMESPACE = {"m": "http://maven.apache.org/POM/4.0.0"}
PACKAGE_PATH = pathlib.Path("dev/scframework/processorfixture")
EXPECTED_TESTS = 2


def stage_number(value):
    if not re.fullmatch(r"[0-9]{3}", value):
        raise argparse.ArgumentTypeError("stage는 008처럼 정확히 세 자리 숫자여야 합니다.")
    return value


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parent_details(parent_path):
    parent = ET.parse(parent_path).getroot()
    coordinates = {}
    for name in ("groupId", "artifactId", "version"):
        value = parent.findtext(f"m:{name}", namespaces=MAVEN_NAMESPACE)
        check(value, f"부모 POM에 {name}이 없습니다.")
        coordinates[name] = value
    properties = parent.find("m:properties", MAVEN_NAMESPACE)
    check(properties is not None, "부모 POM에 Java/processor 버전 속성이 없습니다.")
    versions = {child.tag.rsplit("}", 1)[-1]: child.text for child in properties}
    return coordinates, versions


def fixture_pom(parent_path, coordinates, fixture_folder):
    # Processor 경로·버전·컴파일 옵션은 여기서 복제하지 않고 실제 부모에서 상속한다.
    # Maven relativePath는 fixture 기준 상대 경로로 해석한다. 같은 실제 부모 파일을 가리켜야 한다.
    relative_parent = os.path.relpath(parent_path, fixture_folder.resolve())
    check((fixture_folder / relative_parent).resolve() == parent_path,
          "Fixture의 부모 상대 경로가 실제 backend/pom.xml과 다릅니다.")
    return textwrap.dedent(f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <project xmlns="http://maven.apache.org/POM/4.0.0"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
          <modelVersion>4.0.0</modelVersion>
          <parent>
            <groupId>{escape(coordinates['groupId'])}</groupId>
            <artifactId>{escape(coordinates['artifactId'])}</artifactId>
            <version>{escape(coordinates['version'])}</version>
            <relativePath>{escape(relative_parent)}</relativePath>
          </parent>
          <artifactId>java-processors-fixture</artifactId>
          <name>Isolated Java processors fixture</name>
          <dependencies>
            <dependency>
              <groupId>io.github.openfeign.querydsl</groupId><artifactId>querydsl-jpa</artifactId>
            </dependency>
            <dependency>
              <groupId>jakarta.persistence</groupId><artifactId>jakarta.persistence-api</artifactId>
            </dependency>
            <dependency>
              <groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><scope>provided</scope>
            </dependency>
            <dependency>
              <groupId>org.mapstruct</groupId><artifactId>mapstruct</artifactId>
            </dependency>
            <dependency>
              <groupId>org.springframework.boot</groupId><artifactId>spring-boot</artifactId>
            </dependency>
            <dependency>
              <groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><scope>test</scope>
            </dependency>
          </dependencies>
        </project>
        """)


MAIN_SOURCES = {
    "ProcessorEntity.java": """\
        package dev.scframework.processorfixture;

        import jakarta.persistence.Entity;
        import jakarta.persistence.Id;
        import lombok.AccessLevel;
        import lombok.Getter;
        import lombok.NoArgsConstructor;

        @Entity
        @Getter
        @NoArgsConstructor(access = AccessLevel.PROTECTED)
        public class ProcessorEntity {
            @Id
            private Long id;
            private String title;

            public ProcessorEntity(Long id, String title) {
                this.id = id;
                this.title = title;
            }
        }
        """,
    "ProcessorMapper.java": """\
        package dev.scframework.processorfixture;

        import org.mapstruct.Mapper;
        import org.mapstruct.ReportingPolicy;
        import org.mapstruct.factory.Mappers;

        @Mapper(componentModel = "default", unmappedTargetPolicy = ReportingPolicy.ERROR)
        public interface ProcessorMapper {
            ProcessorMapper INSTANCE = Mappers.getMapper(ProcessorMapper.class);

            ProcessorDto toDto(ProcessorEntity source);
        }
        """,
    "ProcessorProperties.java": """\
        package dev.scframework.processorfixture;

        import lombok.Getter;
        import lombok.Setter;
        import org.springframework.boot.context.properties.ConfigurationProperties;

        @Getter
        @Setter
        @ConfigurationProperties("processor-fixture")
        public class ProcessorProperties {
            private String greeting;
        }
        """,
}

TEST_SOURCE = """\
    package dev.scframework.processorfixture;

    import static org.junit.jupiter.api.Assertions.assertEquals;
    import static org.junit.jupiter.api.Assertions.assertNull;
    import static org.junit.jupiter.api.Assertions.assertTrue;

    import java.lang.reflect.Modifier;
    import org.junit.jupiter.api.Test;

    class ProcessorFixtureTest {
        @Test
        void generatedQueryTypeAndLombokGettersAreMappedAtRuntime() {
            ProcessorEntity entity = new ProcessorEntity(7L, "synthetic-title");
            assertEquals(7L, entity.getId());
            assertEquals("synthetic-title", entity.getTitle());

            QProcessorEntity query = QProcessorEntity.processorEntity;
            assertEquals("id", query.id.getMetadata().getName());
            assertEquals("title", query.title.getMetadata().getName());
            assertEquals(Long.class, query.id.getType());
            assertEquals(String.class, query.title.getType());

            ProcessorDto dto = ProcessorMapper.INSTANCE.toDto(entity);
            assertEquals(entity.getId(), dto.id());
            assertEquals(entity.getTitle(), dto.title());
            assertTrue(ProcessorMapper.INSTANCE.getClass().getSimpleName().equals("ProcessorMapperImpl"));
        }

        @Test
        void generatedConstructorAndMapperNullContractAreUsable() throws ReflectiveOperationException {
            assertTrue(Modifier.isProtected(ProcessorEntity.class.getDeclaredConstructor().getModifiers()));
            assertNull(ProcessorMapper.INSTANCE.toDto(null));
        }
    }
    """


def write_fixture(folder, parent_path, coordinates, negative):
    folder.mkdir()
    (folder / "pom.xml").write_text(fixture_pom(parent_path, coordinates, folder), encoding="utf-8")
    main = folder / "src/main/java" / PACKAGE_PATH
    test = folder / "src/test/java" / PACKAGE_PATH
    main.mkdir(parents=True)
    test.mkdir(parents=True)
    for name, source in MAIN_SOURCES.items():
        (main / name).write_text(textwrap.dedent(source), encoding="utf-8")
    fields = "Long id, String title, String requiredField" if negative else "Long id, String title"
    (main / "ProcessorDto.java").write_text(
        "package dev.scframework.processorfixture;\n\n"
        f"public record ProcessorDto({fields}) {{}}\n", encoding="utf-8",
    )
    (test / "ProcessorFixtureTest.java").write_text(textwrap.dedent(TEST_SOURCE), encoding="utf-8")
    check(not list((folder / "src").rglob("Q*.java")), "Fixture에 직접 작성한 Q 타입이 있습니다.")
    check(not list((folder / "src").rglob("*MapperImpl.java")), "Fixture에 직접 작성한 Mapper 구현이 있습니다.")


def stop_own_process(process):
    # 이 스크립트가 만든 Maven process group만 종료한다. 다른 검증 프로세스에는 접근하지 않는다.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def run_maven(folder, log_path, timeout_seconds):
    command = [
        "bash", "-c", 'set -e; source "$1"; shift; exec "$@"', "sc-java-processors",
        str(ROOT / "scripts/java-env.sh"), str(ROOT / "backend/mvnw"),
        "-B", "-ntp", "-V", "-Dstyle.color=never", "-DskipTests=false", "-Dmaven.test.skip=false",
        "-f", str(folder / "pom.xml"), "clean", "verify",
    ]
    environment = os.environ.copy()
    for key in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS"):
        environment.pop(key, None)
    started = time.monotonic()
    process = subprocess.Popen(
        command, cwd=folder, env=environment, text=True, encoding="utf-8", errors="replace",
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
    )
    timed_out = False
    interrupted = False
    try:
        stdout, stderr = process.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        timed_out = True
        stop_own_process(process)
        stdout, stderr = process.communicate()
    except KeyboardInterrupt:
        interrupted = True
        stop_own_process(process)
        stdout, stderr = process.communicate()
    log_path.write_text(
        f"COMMAND {shlex.join(command)}\n"
        f"EXIT {process.returncode}\nTIMEOUT {str(timed_out).lower()}\n"
        f"INTERRUPTED {str(interrupted).lower()}\n\n"
        f"--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}", encoding="utf-8",
    )
    return {
        "exitCode": process.returncode,
        "durationSeconds": round(time.monotonic() - started, 3),
        "timedOut": timed_out,
        "interrupted": interrupted,
        "command": command,
        "log": str(log_path.relative_to(ROOT)),
        "stdout": stdout,
        "stderr": stderr,
    }


def public_run(result):
    return {key: value for key, value in result.items() if key not in ("stdout", "stderr")}


def successful_fixture_checks(folder, result):
    check(not result["timedOut"] and not result["interrupted"], "성공 fixture Maven이 완료되지 않았습니다.")
    check(result["exitCode"] == 0, "성공 fixture Maven 컴파일/테스트가 실패했습니다.")
    generated = folder / "target/generated-sources/annotations" / PACKAGE_PATH
    query_source = generated / "QProcessorEntity.java"
    mapper_source = generated / "ProcessorMapperImpl.java"
    check(query_source.is_file(), "Querydsl이 실제 QProcessorEntity.java를 생성하지 않았습니다.")
    check(mapper_source.is_file(), "MapStruct가 실제 ProcessorMapperImpl.java를 생성하지 않았습니다.")
    mapper = mapper_source.read_text(encoding="utf-8")
    check("source.getId()" in mapper and "source.getTitle()" in mapper,
          "생성 Mapper가 Lombok getter를 통해 모든 DTO 필드를 매핑하지 않았습니다.")
    classes = folder / "target/classes" / PACKAGE_PATH
    for name in ("ProcessorEntity.class", "QProcessorEntity.class", "ProcessorMapperImpl.class"):
        check((classes / name).is_file(), f"생성·입력 소스가 실제 class로 컴파일되지 않았습니다: {name}")
    report_paths = list((folder / "target/surefire-reports").glob("TEST-*.xml"))
    check(len(report_paths) == 1, "실제 Surefire fixture 테스트 보고서가 정확히 하나여야 합니다.")
    suite = ET.parse(report_paths[0]).getroot()
    counts = {name: int(suite.get(name, "0")) for name in ("tests", "failures", "errors", "skipped")}
    check(counts == {"tests": EXPECTED_TESTS, "failures": 0, "errors": 0, "skipped": 0},
          "실제 생성 타입/Mapper 테스트가 모두 실행·성공하지 않았습니다.")
    cases = {case.get("name") for case in suite.findall("testcase")}
    check(cases == {
        "generatedQueryTypeAndLombokGettersAreMappedAtRuntime",
        "generatedConstructorAndMapperNullContractAreUsable",
    }, "Surefire 보고서에 실제 runtime 매핑 fixture 테스트가 없습니다.")
    system_properties = {prop.get("name"): prop.get("value")
                         for prop in suite.findall("properties/property")}
    check(re.match(r"^21(?:\.|$)", system_properties.get("java.version", "")),
          "Fixture 테스트가 JDK 21에서 실행되지 않았습니다.")
    metadata_path = folder / "target/classes/META-INF/spring-configuration-metadata.json"
    check(metadata_path.is_file(), "Boot configuration processor 메타데이터가 생성되지 않았습니다.")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    check(any(prop.get("name") == "processor-fixture.greeting" and prop.get("type") == "java.lang.String"
              for prop in metadata.get("properties", [])),
          "상속한 Boot configuration processor가 합성 설정 필드 메타데이터를 생성하지 않았습니다.")
    paths = (query_source, mapper_source, metadata_path)
    return {
        "tests": counts,
        "testNames": sorted(cases),
        "javaVersion": system_properties["java.version"],
        "javaVmName": system_properties.get("java.vm.name"),
        "generatedFiles": [{"path": str(path.relative_to(folder)), "sha256": sha256(path)} for path in paths],
        "compiledGeneratedTypes": ["QProcessorEntity.class", "ProcessorMapperImpl.class"],
        "lombokGettersMapped": True,
        "protectedNoArgsConstructorVerified": True,
        "bootConfigurationMetadataPreserved": True,
    }


def rejected_fixture_checks(folder, result):
    check(not result["timedOut"] and not result["interrupted"], "실패 fixture Maven이 완료되지 않았습니다.")
    check(result["exitCode"] == 1, "미매핑 DTO fixture의 실제 Maven 종료 코드가 1이 아닙니다.")
    # Maven compiler 진단은 stdout에도 기록된다. 두 원문을 보존하고 실제 발생한 스트림을 명시한다.
    diagnostic = re.compile(
        r"ProcessorMapper\.java:\[\d+,\d+\]\s*Unmapped target property: [\"']requiredField[\"']\."
    )
    streams = [name for name in ("stdout", "stderr") if diagnostic.search(result[name])]
    check(streams, "종료 실패에 requiredField의 정확한 MapStruct 미매핑 컴파일 진단이 없습니다.")
    combined = result["stdout"] + "\n" + result["stderr"]
    check(re.search(r"maven-compiler-plugin:[^:\s]+:compile", combined),
          "미매핑 필드가 실제 Maven compiler compile 단계에서 차단되지 않았습니다.")
    check("BUILD FAILURE" in combined and "BUILD SUCCESS" not in combined,
          "미매핑 필드 fixture가 실제 Maven BUILD FAILURE로 종료되지 않았습니다.")
    check(not list((folder / "target/surefire-reports").glob("TEST-*.xml")),
          "미매핑 DTO가 compile gate를 통과하여 테스트 단계까지 실행되었습니다.")
    check(not (folder / "target/classes" / PACKAGE_PATH / "ProcessorMapperImpl.class").exists(),
          "미매핑 DTO용 Mapper 구현이 성공적으로 컴파일되었습니다.")
    return {
        "expectedExitCode": 1,
        "unmappedProperty": "requiredField",
        "diagnostic": diagnostic.search(combined).group(0),
        "diagnosticStreams": streams,
        "compileBlocked": True,
        "testsNeverStarted": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=stage_number, default="008", help="증거 파일의 세 자리 단계 번호 (기본: 008)")
    args = parser.parse_args()
    evidence = ROOT / "docs/검증"
    evidence.mkdir(parents=True, exist_ok=True)
    positive_log = evidence / f"{args.stage}-processor-positive.log"
    negative_log = evidence / f"{args.stage}-processor-negative.log"
    report_path = evidence / f"{args.stage}-java-processors.json"
    report = {
        "stage": args.stage,
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "passed": False,
        "parentPom": "backend/pom.xml",
        "parentResolution": "fixture relativePath resolves to the actual parent; processor configuration is not copied",
        "javaEnvironmentScript": "scripts/java-env.sh",
        "mavenWrapper": "backend/mvnw",
        "fixtureSource": "synthetic-only; no manually written Q type or Mapper implementation",
        "positive": None,
        "negative": None,
        "temporaryDirectoryCleaned": False,
        "errors": [],
    }
    temporary = None
    phase = "부모 POM 및 wrapper 준비 확인"
    try:
        parent_path = (ROOT / "backend/pom.xml").resolve(strict=True)
        check((ROOT / "backend/mvnw").is_file(), "고정 Maven wrapper가 없습니다.")
        check((ROOT / "scripts/java-env.sh").is_file(), "JDK 21 환경 스크립트가 없습니다.")
        coordinates, versions = parent_details(parent_path)
        report["parentSha256"] = sha256(parent_path)
        report["parentCoordinates"] = coordinates
        report["declaredVersions"] = {name: versions.get(name) for name in (
            "java.version", "sc-querydsl.version", "mapstruct.version", "lombok.version",
            "lombok-mapstruct-binding.version",
        )}
        temporary = tempfile.TemporaryDirectory(prefix=f"sc-java-processors-{args.stage}-")
        temporary_path = pathlib.Path(temporary.name)
        positive = temporary_path / "positive"
        negative = temporary_path / "negative"
        write_fixture(positive, parent_path, coordinates, negative=False)
        write_fixture(negative, parent_path, coordinates, negative=True)

        phase = "성공 fixture의 실제 Maven 컴파일·runtime 매핑"
        positive_result = run_maven(positive, positive_log, timeout_seconds=300)
        report["positive"] = public_run(positive_result)
        report["positive"]["checks"] = successful_fixture_checks(positive, positive_result)
        print("PASS Querydsl/Lombok/MapStruct 실제 생성·컴파일·runtime 매핑 및 Boot 메타데이터", flush=True)

        phase = "미매핑 DTO 실패 fixture의 실제 Maven compile gate"
        negative_result = run_maven(negative, negative_log, timeout_seconds=300)
        report["negative"] = public_run(negative_result)
        report["negative"]["checks"] = rejected_fixture_checks(negative, negative_result)
        print("PASS requiredField 미매핑이 실제 compile 단계에서 종료 코드 1로 차단됨", flush=True)
        check(sha256(parent_path) == report["parentSha256"], "검증 도중 부모 POM이 변경되었습니다.")
        report["passed"] = True
    except Exception as error:
        report["errors"].append({"phase": phase, "message": str(error), "type": type(error).__name__})
        print(f"FAIL {phase}: {error}", flush=True)
    finally:
        if temporary is not None:
            temporary_path = pathlib.Path(temporary.name)
            try:
                temporary.cleanup()
                report["temporaryDirectoryCleaned"] = not temporary_path.exists()
            except OSError as error:
                report["errors"].append({"phase": "임시 fixture 정리", "message": str(error), "type": type(error).__name__})
        else:
            report["temporaryDirectoryCleaned"] = True
        report["passed"] = report["passed"] and report["temporaryDirectoryCleaned"] and not report["errors"]
        report["finishedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"증거: {report_path.relative_to(ROOT)}", flush=True)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
