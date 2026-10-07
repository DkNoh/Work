import axios, { type AxiosAdapter, type AxiosRequestConfig } from "axios";

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
  signal?: AbortSignal;
  responseType?: "blob" | "arraybuffer";
};
export type HttpClientOptions = {
  baseURL?: string;
  adapter?: AxiosAdapter;
  onSessionChange?: (reason: SessionReason) => void;
};

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

export function createHttpClient(options: HttpClientOptions = {}) {
  const http = axios.create({
    baseURL: options.baseURL ?? "/api",
    withCredentials: true,
    timeout: 30_000,
    headers: { Accept: "application/json" },
    ...(options.adapter ? { adapter: options.adapter } : {}),
  });
  let generation = 0;
  let csrf: CsrfToken | null = null;
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
      const pending = request<CsrfToken>("/auth/csrf")
        .then((token) => {
          checkGeneration(epoch);
          if (typeof token?.headerName !== "string" || typeof token?.token !== "string") {
            throw new ApiError("보안 토큰 응답을 확인해 주세요.", 0, "INVALID_CSRF_RESPONSE");
          }
          csrf = token;
        })
        .finally(() => {
          if (csrfRequest === pending) csrfRequest = null;
        });
      csrfRequest = pending;
    }
    await csrfRequest;
    checkGeneration(epoch);
  }

  async function request<T>(
    path: string,
    method = "GET",
    data?: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const epoch = generation;
    checkGeneration(epoch);
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
      if (response.status >= 400) {
        const body = await decodeErrorBody(response.data);
        checkGeneration(epoch);
        throw responseError(response.status, body);
      }
      return response.status === 204 ? (undefined as T) : response.data;
    } catch (cause: unknown) {
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
      if (failure.status === 403 && failure.code === "CSRF") csrf = null;
      if (failure.status === 401 && failure.code !== "AUTH_FAILED") resetSession("unauthorized");
      throw failure;
    } finally {
      requestOptions.signal?.removeEventListener("abort", abortExternal);
      requests.delete(controller);
    }
  }

  async function login(username: string, password: string) {
    resetSession("login");
    await request<void>("/auth/login", "POST", new URLSearchParams({ username, password }));
    // 로그인은 서버 세션과 CSRF를 바꾼다. 로그인 전 토큰을 저장 요청에 재사용하지 않는다.
    resetSession("login");
  }

  async function logout() {
    await request<void>("/auth/logout", "POST");
    resetSession("logout");
  }

  function dispose() {
    disposed = true;
    resetSession("dispose");
  }

  return { request, login, logout, resetSession, dispose, getGeneration: () => generation };
}
