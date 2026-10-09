/**
 * 업무 HTTP의 공통 경계다. 앱/컴포넌트는 이 client를 공유하고 Axios 인스턴스를 따로 만들지 않는다.
 * Spring 서버의 쿠키 세션·CSRF와 오류 JSON을 브라우저 코드에 연결한다.
 * Vue ref/store가 아니라 함수의 클로저가 통신 상태를 소유하므로 runtime별로 독립적이다.
 */
import axios, { type AxiosAdapter, type AxiosRequestConfig } from "axios";

// 서버 오류 { code, message, errors[] }를 화면이 다루기 쉬운 Error로 바꾼다.
// fields는 필드명→메시지 사전이며 폼에서 VeeValidate 등의 필드 오류와 연결할 수 있다.
// 생성자 인수의 public은 TypeScript의 parameter property로 같은 이름의 인스턴스 필드를 만든다.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type CsrfToken = { headerName: string; token: string };
type SessionReason = "login" | "logout" | "unauthorized" | "reset" | "dispose";
export type RequestOptions = {
  // AbortSignal은 폼 이탈/Query 취소 같은 호출자 측 중단 의사를 전달한다.
  signal?: AbortSignal;
  responseType?: "blob" | "arraybuffer";
};
export type HttpClientOptions = {
  baseURL?: string;
  adapter?: AxiosAdapter;
  onSessionChange?: (reason: SessionReason) => void;
};

// data: unknown은 외부 응답을 신뢰하지 않는다는 뜻이다. 객체/배열/문자열을 확인한 뒤
// 필요한 오류 항목만 추출하고, 누락되거나 잘못된 서버 문구는 공통 기본값으로 대신한다.
function responseError(status: number, data: unknown) {
  const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const fields: Record<string, string> = {};
  for (const item of Array.isArray(body.errors) ? body.errors : []) {
    if (item && typeof item.field === "string" && typeof item.message === "string") {
      fields[item.field] = item.message;
    }
  }
  return new ApiError(
    typeof body.message === "string" ? body.message : "요청을 처리하지 못했습니다.",
    status,
    typeof body.code === "string" ? body.code : "HTTP_ERROR",
    fields,
  );
}

/** 파일 요청의 JSON 오류만 작은 범위에서 해석한다. 파일 본문을 오류/로그로 노출하지 않는다. */
async function decodeErrorBody(data: unknown): Promise<unknown> {
  // 다운로드가 실패하면 responseType 때문에 JSON 오류도 Blob/ArrayBuffer로 도착한다.
  // 최대 64KiB만 JSON 파싱하며, 원문이 파일이거나 잘못된 JSON이면 undefined로 처리한다.
  let text: string;
  if (data instanceof Blob) {
    if (data.size > 65_536) return undefined;
    text = await data.text();
  } else if (data instanceof ArrayBuffer) {
    if (data.byteLength > 65_536) return undefined;
    text = new TextDecoder().decode(data);
  } else return data;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * 기본 /api 경로·쿠키 포함·30초 timeout을 갖춘 client를 생성한다.
 * adapter는 주로 테스트에서 실제 네트워크 대신 응답을 주입하는 경계다.
 * 반환된 request<T>의 T는 호출자가 기대하는 응답 타입이며 자동 JSON 검증기가 아니다.
 */
export function createHttpClient(options: HttpClientOptions = {}) {
  const http = axios.create({
    baseURL: options.baseURL ?? "/api",
    withCredentials: true,
    timeout: 30_000,
    headers: { Accept: "application/json" },
    ...(options.adapter ? { adapter: options.adapter } : {}),
  });
  // generation은 서버 세션 ID가 아니라 이 client의 세션 변경 횟수다.
  // 요청 시작 시 복사한 epoch와 비교해 이전 사용자 세션에서 늦게 온 응답을 버린다.
  let generation = 0;
  let csrf: CsrfToken | null = null;
  // 토큰 값과 진행 중인 토큰 조회 Promise를 따로 보관해 동시 쓰기 요청이 하나의 조회를 기다린다.
  let csrfRequest: Promise<void> | null = null;
  let disposed = false;
  const requests = new Set<AbortController>();

  function changedSession() {
    return new ApiError("로그인 상태가 변경되었습니다. 다시 로그인하세요.", 401, "SESSION_CHANGED");
  }

  function checkGeneration(epoch: number) {
    if (epoch !== generation) throw changedSession();
    if (disposed) throw new ApiError("앱 연결이 종료되었습니다.", 0, "RUNTIME_DISPOSED");
  }

  // 인증 경계가 바뀌면 토큰과 모든 진행 중 요청을 함께 폐기한다. 이미 취소가 늦어진
  // 응답도 generation 비교로 차단한다. onSessionChange가 Pinia/Query 등 상위 상태를 비운다.
  function resetSession(reason: SessionReason = "reset") {
    generation += 1;
    csrf = null;
    csrfRequest = null;
    for (const request of requests) request.abort();
    requests.clear();
    options.onSessionChange?.(reason);
  }

  async function ensureCsrf(epoch: number) {
    checkGeneration(epoch);
    if (csrf) return;
    if (!csrfRequest) {
      // /auth/csrf 자체는 GET이므로 request가 다시 ensureCsrf를 호출하는 재귀는 생기지 않는다.
      const pending = request<CsrfToken>("/auth/csrf")
        .then((token) => {
          checkGeneration(epoch);
          if (typeof token?.headerName !== "string" || typeof token?.token !== "string") {
            throw new ApiError("보안 토큰 응답을 확인해 주세요.", 0, "INVALID_CSRF_RESPONSE");
          }
          csrf = token;
        })
        .finally(() => {
          // 이전 조회가 늦게 끝나도 새 세션에서 시작한 csrfRequest를 지우지 않는다.
          if (csrfRequest === pending) csrfRequest = null;
        });
      csrfRequest = pending;
    }
    await csrfRequest;
    checkGeneration(epoch);
  }

  /**
   * /로 시작하는 업무 API 경로, HTTP 메서드, 선택 본문/취소 설정을 받아 Promise<T>를 반환한다.
   * 성공 JSON은 response.data 그대로 돌려주며 공통 success/data 봉투를 덧씌우지 않는다.
   * 데이터가 없는 204는 undefined이고 실패는 ApiError로 throw되어 호출자의 catch로 전달된다.
   */
  async function request<T>(
    path: string,
    method = "GET",
    data?: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const epoch = generation;
    checkGeneration(epoch);
    // /api 기준 상대 경로만 허용한다. //host 형태의 프로토콜 상대 URL도 거절한다.
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new ApiError("업무 API의 상대 경로를 사용해 주세요.", 0, "INVALID_API_PATH");
    }
    // 연결된 폼도 취소할 수 있지만 세션 변경은 이 runtime의 모든 요청을 폐기한다.
    const controller = new AbortController();
    const abortExternal = () => controller.abort();
    requestOptions.signal?.addEventListener("abort", abortExternal, { once: true });
    if (requestOptions.signal?.aborted) controller.abort();
    requests.add(controller);
    try {
      const verb = method.toUpperCase();
      // 조회 계열은 CSRF 없이 진행하고 쓰기 계열은 서버가 알려 준 headerName/token을 붙인다.
      // 쿠키의 토큰 이름을 추측하거나 헤더 이름을 업무 화면마다 하드코딩하지 않는다.
      if (!["GET", "HEAD", "OPTIONS"].includes(verb)) await ensureCsrf(epoch);
      checkGeneration(epoch);
      const config: AxiosRequestConfig = {
        url: path,
        method: verb,
        data,
        signal: controller.signal,
        ...(requestOptions.responseType ? { responseType: requestOptions.responseType } : {}),
      };
      if (csrf && !["GET", "HEAD", "OPTIONS"].includes(verb)) {
        config.headers = { [csrf.headerName]: csrf.token };
      }
      const response = await http.request<T>(config);
      checkGeneration(epoch);
      // 기본 Axios는 4xx/5xx를 reject하지만, 응답을 resolve하는 adapter에서도 같은 계약을 지킨다.
      if (response.status >= 400) {
        const body = await decodeErrorBody(response.data);
        checkGeneration(epoch);
        throw responseError(response.status, body);
      }
      return response.status === 204 ? (undefined as T) : response.data;
    } catch (cause: unknown) {
      // 세션 변경이 우선이다. 이전 요청의 성공/실패 모두 새 로그인 화면의 상태를 바꾸면 안 된다.
      if (epoch !== generation) throw changedSession();
      let errorBody: unknown;
      if (axios.isAxiosError(cause) && cause.response) {
        errorBody = await decodeErrorBody(cause.response.data);
        checkGeneration(epoch);
      }
      const failure =
        cause instanceof ApiError
          ? cause
          : axios.isAxiosError(cause) && cause.response
            ? responseError(cause.response.status, errorBody)
            : new ApiError(
                axios.isCancel(cause) ? "요청이 취소되었습니다." : "서버에 연결하지 못했습니다.",
                0,
                axios.isCancel(cause) ? "REQUEST_CANCELLED" : "NETWORK_ERROR",
              );
      // CSRF 오류는 캐시한 토큰만 폐기한다. 여기서 원래 쓰기 요청을 자동 재전송하지 않는다.
      // 잘못된 로그인 자격(AUTH_FAILED)은 일반 401 세션 만료와 구분한다.
      if (failure.status === 403 && failure.code === "CSRF") csrf = null;
      if (failure.status === 401 && failure.code !== "AUTH_FAILED") resetSession("unauthorized");
      throw failure;
    } finally {
      // 성공·실패·취소 모두에서 외부 signal listener와 내부 요청 목록을 정리한다.
      // 화면이 떠난 뒤에도 요청마다 등록한 이벤트 핸들러가 쌓이는 것을 막는다.
      requestOptions.signal?.removeEventListener("abort", abortExternal);
      requests.delete(controller);
    }
  }

  async function login(username: string, password: string) {
    // 로그인 시작 전 기존 요청을 폐기한다. URLSearchParams는 서버 로그인 폼 인코딩에 맞춘다.
    resetSession("login");
    await request<void>("/auth/login", "POST", new URLSearchParams({ username, password }));
    // 로그인은 서버 세션과 CSRF를 바꾼다. 로그인 전 토큰을 저장 요청에 재사용하지 않는다.
    resetSession("login");
  }

  async function logout() {
    // 서버 로그아웃이 성공했을 때 로컬 세션을 초기화한다. 실패는 호출자에게 그대로 전달한다.
    await request<void>("/auth/logout", "POST");
    resetSession("logout");
  }

  function dispose() {
    // 앱 종료 이후 새 요청도 거절하도록 표시한 다음 진행 중 통신을 취소한다.
    disposed = true;
    resetSession("dispose");
  }

  return { request, login, logout, resetSession, dispose, getGeneration: () => generation };
}
