#!/usr/bin/env python3
"""새 합성 JAR에서 실제 Prometheus·Tempo·Loki·Grafana와 Feign 경계를 확인한다."""
import argparse
import base64
import http.server
import json
import pathlib
import re
import shutil
import stat
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from _harness import ROOT, HttpClient
from _operations_harness import operations_server

CANARY = "SC_PRIVATE_OBSERVABILITY_CANARY"


def check(condition, reason):
    if not condition:
        raise AssertionError(reason)


def raw(url, headers=None, timeout=15):
    try:
        response = urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read()


def basic(username, password):
    return {"Authorization": "Basic " + base64.b64encode((username + ":" + password).encode()).decode()}


def query(base, path, parameters, headers=None):
    status, content = raw(base + path + "?" + urllib.parse.urlencode(parameters), headers)
    check(status == 200, "OBS_QUERY_HTTP_STATUS")
    result = json.loads(content)
    check(result.get("status", "success") == "success", "OBS_QUERY_STATUS")
    return result


def poll(action, seconds=45):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = action()
        if result:
            return result
        time.sleep(0.5)
    raise AssertionError("OBS_BOUNDED_QUERY_TIMEOUT")


def spans(value):
    if isinstance(value, dict):
        if "spanId" in value and "traceId" in value:
            yield value
        for child in value.values():
            yield from spans(child)
    elif isinstance(value, list):
        for child in value:
            yield from spans(child)


def hex_id(value):
    if re.fullmatch(r"[a-fA-F0-9]{16}|[a-fA-F0-9]{32}", value or ""):
        return value.lower()
    return base64.b64decode(value or "").hex()


class Echo(http.server.BaseHTTPRequestHandler):
    mode = "success"
    requests = []

    def log_message(self, *_):
        pass

    def do_GET(self):
        type(self).requests.append({key.lower(): value for key, value in self.headers.items()})
        mode = type(self).mode
        if mode == "timeout":
            time.sleep(5.6)
        body = json.dumps({"message": "loopback" if mode == "success" else CANARY}).encode()
        try:
            self.send_response(500 if mode == "failure" else 200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=pathlib.Path, required=True)
    parser.add_argument("--shared-home", type=pathlib.Path, default=ROOT / ".runtime/operations")
    parser.add_argument("--grafana-browser-output", type=pathlib.Path, help="실행 중인 fixture의 실제 지표로 Grafana 브라우저도 확인한다")
    args = parser.parse_args()
    check(not args.report.exists(), "OBS_REPORT_ALREADY_EXISTS")
    report = {"stage": "012", "passed": False, "groups": [], "manualReviewComplete": False}
    server = None
    echo = None

    def record(name, details=None):
        report["groups"].append({"name": name, "passed": True, **(details or {})})
        print("PASS " + name, flush=True)

    try:
        shared = args.shared_home.resolve() / "secrets/operations"
        observer = (shared / "observer.secret").read_text().strip()
        grafana = (shared / "grafana.secret").read_text().strip()
        echo = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Echo)
        echo.daemon_threads = True
        threading.Thread(target=echo.serve_forever, daemon=True).start()
        server = operations_server(management_port=18482, shared_home=args.shared_home)
        pinned = server.folder / "observability-app.jar"
        shutil.copyfile(server.jar, pinned)
        server.jar = pinned
        server.extra_environment["SC_ECHO_URL"] = "http://127.0.0.1:" + str(echo.server_port)
        server.start()
        client = HttpClient(server)
        client.login()
        management = "http://127.0.0.1:18482/actuator/prometheus"
        check(raw(management)[0] == 401, "OBS_METRICS_ANONYMOUS")
        check(raw(management, basic("sc-observer", "invalid"))[0] == 401, "OBS_METRICS_WRONG_SECRET")
        check(raw(management, basic("admin", server.password))[0] == 401, "OBS_METRICS_BUSINESS_CREDENTIAL")
        check(raw(server.base_url + "/api/framework/capabilities", basic("sc-observer", observer))[0] == 401,
              "OBS_OBSERVER_BUSINESS_ACCESS")
        business_status, business_body = raw(server.base_url + "/actuator/prometheus", basic("sc-observer", observer))
        check(business_status in (200, 401, 403, 404) and b"jvm_memory_used_bytes" not in business_body,
              "OBS_METRICS_BUSINESS_PORT")
        client.request("/actuator/prometheus", expected=404)
        client.request("/api/operations/messages/demo", "POST", {}, expected=403, csrf=False)
        metrics_status, metrics = raw(management, basic("sc-observer", observer))
        check(metrics_status == 200, "OBS_METRICS_PRIVATE_ACCESS")
        record("separate-observer-authentication-and-business-csrf", {"rejectedCredentialBoundaries": 5})

        before = len(Echo.requests)
        success = client.request("/api/integration/echo?private=" + CANARY)
        check(success == {"message": "loopback"}, "OBS_FEIGN_SUCCESS")
        check(len(Echo.requests) == before + 1, "OBS_FEIGN_DUPLICATE_ATTEMPT")
        outbound = Echo.requests[-1]
        check(not ({"cookie", "authorization", "x-csrf-token"} & outbound.keys()), "OBS_FEIGN_USER_CREDENTIAL_FORWARDING")
        traceparent = outbound.get("traceparent", "")
        check(bool(re.fullmatch(r"00-[a-f0-9]{32}-[a-f0-9]{16}-01", traceparent)), "OBS_FEIGN_TRACE_PROPAGATION")
        check(bool(outbound.get("x-request-id")), "OBS_FEIGN_REQUEST_ID")
        trace_id, client_span_id = traceparent.split("-")[1:3]
        Echo.mode = "failure"
        failure = client.request("/api/integration/echo?private=" + CANARY, expected=502)
        check(failure["code"] == "UPSTREAM_FAILURE" and CANARY not in json.dumps(failure), "OBS_FEIGN_FAILURE_REDACTION")
        Echo.mode = "timeout"
        started = time.monotonic()
        timeout = client.request("/api/integration/echo", expected=504)
        duration = time.monotonic() - started
        check(timeout["code"] == "UPSTREAM_TIMEOUT" and 4.5 <= duration <= 8, "OBS_FEIGN_BOUNDED_TIMEOUT")
        check(len(Echo.requests) == before + 3, "OBS_FEIGN_RETRY_DISABLED")
        Echo.mode = "success"
        record("actual-feign-success-failure-timeout-and-trace-propagation", {"attempts": 3, "timeoutSeconds": round(duration, 3)})

        def server_ancestor(by_id, child):
            seen = set()
            current = child
            while current is not None and len(seen) < 32:
                identity = hex_id(current.get("spanId"))
                if identity in seen:
                    return None
                seen.add(identity)
                if current.get("name") == "SC SERVER":
                    return current
                current = by_id.get(hex_id(current.get("parentSpanId")))
            return None

        def trace_query():
            status, body = raw("http://127.0.0.1:13200/api/v2/traces/" + trace_id, {"Accept": "application/json"})
            if status != 200 or not body:
                return None
            result = json.loads(body)
            by_id = {hex_id(item["spanId"]): item for item in spans(result)}
            child = by_id.get(client_span_id)
            return result if child is not None and server_ancestor(by_id, child) is not None else None

        trace = poll(trace_query)
        exported = list(spans(trace))
        by_id = {hex_id(item["spanId"]): item for item in exported}
        check(client_span_id in by_id, "OBS_TEMPO_CLIENT_SPAN")
        child = by_id[client_span_id]
        parent = server_ancestor(by_id, child)
        check(parent is not None and child["name"] == "SC CLIENT" and parent["name"] == "SC SERVER",
              "OBS_TEMPO_PARENT_CHILD")
        for item in exported:
            check(item.get("name") in {"SC SERVER", "SC CLIENT", "SC INTERNAL", "SC PRODUCER", "SC CONSUMER"}, "OBS_TEMPO_SAFE_NAME")
            check({attr["key"] for attr in item.get("attributes", [])} <=
                  {"http.route", "http.request.method", "http.response.status_code", "error.type"}, "OBS_TEMPO_ATTRIBUTE_ALLOWLIST")
            check(not item.get("events") and not item.get("links"), "OBS_TEMPO_EXCEPTION_EXPORT")
        check(CANARY not in json.dumps(trace), "OBS_TEMPO_CANARY_LEAK")
        record("collector-tempo-actual-server-client-trace", {"spanCount": len(exported), "parentChild": True})

        selector = '{service_name="sc-reference-app"} |= "' + trace_id + '"'

        def log_query(base="http://127.0.0.1:13100", path="/loki/api/v1/query_range", headers=None):
            return query(base, path, {"query": selector, "start": str(int((time.time() - 600) * 1e9)),
                                     "end": str(int(time.time() * 1e9)), "limit": "100"}, headers)

        logs = poll(lambda: (lambda result: result if result["data"]["result"] else None)(log_query()))
        lines = [json.loads(value[1]) for stream in logs["data"]["result"] for value in stream["values"]]
        check(any(item.get("kind") == "HTTP_REQUEST" and item.get("traceId") == trace_id for item in lines), "OBS_LOKI_TRACE_CORRELATION")
        check(all(set(item) <= {"timestamp", "kind", "outcome", "eventId", "traceId", "spanId"} for item in lines), "OBS_LOKI_BODY_ALLOWLIST")
        record("collector-loki-actual-safe-log-trace-correlation", {"matchedLogs": len(lines)})

        up_query = 'up{job="sc-framework-native"}'
        prometheus = "http://127.0.0.1:19090"
        poll(lambda: any(float(item["value"][1]) == 1 for item in query(prometheus, "/api/v1/query", {"query": up_query})["data"]["result"]))
        sums = {}
        for metric in ("jvm_memory_used_bytes", "hikaricp_connections_active", "http_server_requests_seconds_count",
                       "http_server_requests_seconds_bucket", "sc_operations_events_total"):
            result = query(prometheus, "/api/v1/query", {"query": 'sum(' + metric + '{job="sc-framework-native"})'})["data"]["result"]
            check(bool(result), "OBS_PROMETHEUS_REQUIRED_METRIC_" + metric)
            sums[metric] = float(result[0]["value"][1])
        check(sums["http_server_requests_seconds_count"] >= 3 and sums["sc_operations_events_total"] >= 3, "OBS_PROMETHEUS_COUNTERS")
        _, metrics = raw(management, basic("sc-observer", observer))
        for line in metrics.decode().splitlines():
            if line.startswith("sc_operations_events_total{"):
                check(set(re.findall(r'(\w+)="', line)) <= {"kind", "outcome"}, "OBS_METRIC_LABEL_CARDINALITY")
        record("prometheus-live-scrape-jvm-hikari-http-histogram-and-bounded-events", {"metricNames": list(sums), "scrapeUp": True})

        grafana_headers = basic("sc-admin", grafana)
        status, body = raw("http://127.0.0.1:13000/api/datasources", grafana_headers)
        check(status == 200 and {item["uid"] for item in json.loads(body)} >= {"sc-prometheus", "sc-tempo", "sc-loki"}, "OBS_GRAFANA_DATASOURCES")
        status, dashboard = raw("http://127.0.0.1:13000/api/dashboards/uid/sc-framework-operations", grafana_headers)
        check(status == 200 and len(json.loads(dashboard)["dashboard"]["panels"]) >= 6, "OBS_GRAFANA_DASHBOARD")
        proxy = "http://127.0.0.1:13000/api/datasources/proxy/uid/"
        proxied_up = query(proxy + "sc-prometheus", "/api/v1/query", {"query": up_query}, grafana_headers)
        check(any(float(item["value"][1]) == 1 for item in proxied_up["data"]["result"]), "OBS_GRAFANA_PROMETHEUS_QUERY")
        status, proxied_trace = raw(proxy + "sc-tempo/api/v2/traces/" + trace_id,
                                    {**grafana_headers, "Accept": "application/json"})
        check(status == 200 and list(spans(json.loads(proxied_trace))), "OBS_GRAFANA_TEMPO_QUERY")
        check(log_query(proxy + "sc-loki", "/loki/api/v1/query_range", grafana_headers)["data"]["result"], "OBS_GRAFANA_LOKI_QUERY")
        record("grafana-provisioned-dashboard-and-three-real-datasource-queries", {"dataSources": 3, "panels": len(json.loads(dashboard)["dashboard"]["panels"])})

        if args.grafana_browser_output:
            # 짧은 fixture가 range query의 평가 간격 사이에 사라지지 않도록 실제 표본을 유지한다.
            deadline = time.monotonic() + 35
            while time.monotonic() < deadline:
                client.request("/api/integration/echo")
                time.sleep(0.5)
            result = subprocess.run(["node", str(ROOT / "scripts/verify-grafana-browser.mjs"), "--output",
                                     str(args.grafana_browser_output), "--secret-file", str(shared / "grafana.secret")],
                                    cwd=ROOT, capture_output=True, text=True, timeout=90)
            check(result.returncode == 0, "OBS_GRAFANA_REAL_BROWSER")
            browser_report = json.loads((args.grafana_browser_output / "summary.json").read_text())
            check(browser_report["passed"] and browser_report["populatedMetricQueries"] >= 5,
                  "OBS_GRAFANA_POPULATED_METRIC_PANELS")
            record("actual-grafana-browser-five-populated-metric-panels-and-safe-logs",
                   {"populatedMetricQueries": browser_report["populatedMetricQueries"], "visiblePanels": len(browser_report["panels"])})

        values = [server.password.encode(), CANARY.encode(), observer.encode(), grafana.encode(),
                  (shared / "spring.rabbitmq.password").read_bytes().strip()]
        public_outputs = [metrics, json.dumps(trace).encode(), json.dumps(logs).encode(), proxied_trace]
        public_outputs += [item.read_bytes() for item in server.folder.rglob("*") if item.is_file() and item.suffix in (".log", ".ndjson")]
        check(all(not value or all(value not in output for output in public_outputs) for value in values), "OBS_SECRET_CANARY_LEAK")
        log_file = server.folder / "logs/operations.ndjson"
        check(log_file.is_file() and stat.S_IMODE(log_file.stat().st_mode) == 0o600, "OBS_PRIVATE_EVENT_LOG")
        record("actual-metrics-traces-logs-and-process-log-secret-canary-scan", {"secretMatches": 0, "logFileMode": "600"})
        report["passed"] = True
    except (OSError, ValueError, RuntimeError, AssertionError) as error:
        report["failureType"] = type(error).__name__
        if isinstance(error, AssertionError) and str(error).startswith("OBS_"):
            report["failureCode"] = str(error)
        print("FAIL observability verification (" + type(error).__name__ + ")", flush=True)
    finally:
        if server is not None:
            server.cleanup()
        if echo is not None:
            echo.shutdown()
            echo.server_close()
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
