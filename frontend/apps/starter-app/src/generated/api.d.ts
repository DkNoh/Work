export interface paths {
    "/api/auth/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 현재 세션의 CSRF 토큰 발급 */
        get: operations["csrf"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 폼 로그인 */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description GET /api/auth/csrf가 발급한 token. Swagger interceptor가 갱신한다. */
                    "X-CSRF-TOKEN"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/x-www-form-urlencoded": {
                        /** Format: password */
                        password: string;
                        username: string;
                    };
                };
            };
            responses: {
                /** @description 성공, 본문 없음 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 인증 실패 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description CSRF 거부 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 세션 로그아웃 */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description GET /api/auth/csrf가 발급한 token. Swagger interceptor가 갱신한다. */
                    "X-CSRF-TOKEN"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 성공, 본문 없음 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 인증 실패 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description CSRF 거부 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 현재 로그인 사용자 */
        get: operations["me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/framework/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 활성 선택 기능 조회 */
        get: operations["capabilities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 애플리케이션 기본 상태 */
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/browser-errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 등록 코드의 브라우저 오류 보고 */
        post: operations["scOperations_post_browser_errors"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/browser-errors/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 브라우저 오류 집계 조회 */
        get: operations["scOperations_get_browser_errors_groups"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/browser-errors/groups/{id}/occurrences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 브라우저 오류 발생 이력 조회 */
        get: operations["scOperations_get_browser_errors_groups_id_occurrences"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/jobs/registered": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 등록 운영 작업 조회 */
        get: operations["scOperations_get_jobs_registered"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/jobs/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 운영 실행 이력 조회 */
        get: operations["scOperations_get_jobs_runs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/jobs/schedules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 운영 예약 조회 */
        get: operations["scOperations_get_jobs_schedules"];
        put?: never;
        /** 등록 작업 예약 */
        post: operations["scOperations_post_jobs_schedules"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/jobs/schedules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 운영 예약 단건 조회 */
        get: operations["scOperations_get_jobs_schedules_id_"];
        /** 운영 예약 변경 */
        put: operations["scOperations_put_jobs_schedules_id_"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/jobs/schedules/{id}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 운영 예약 일시정지 */
        post: operations["scOperations_post_jobs_schedules_id_pause"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/jobs/schedules/{id}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 운영 예약 재개 */
        post: operations["scOperations_post_jobs_schedules_id_resume"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["scOperations_get_messages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/messages/demo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["scOperations_post_messages_demo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/operations/messages/{eventId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["scOperations_post_messages_eventId_retry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/storage-demo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/storage-demo/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["download"];
        put?: never;
        post?: never;
        delete: operations["delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ApiError: {
            code: string;
            errors: components["schemas"]["FieldViolation"][];
            message: string;
        };
        BrowserErrorAccepted: {
            accepted: boolean;
        };
        BrowserErrorGroupPage: {
            items: components["schemas"]["BrowserErrorGroupResponse"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        BrowserErrorGroupResponse: {
            appVersion: string;
            /** @enum {string} */
            componentCode: "ROOT";
            /** @enum {string} */
            eventCode: "VUE_ERROR" | "WINDOW_ERROR" | "UNHANDLED_REJECTION" | "UNKNOWN_RUNTIME";
            fingerprint: string;
            /** Format: date-time */
            firstSeenAt: string;
            /** Format: int64 */
            id: number;
            /** Format: date-time */
            lastSeenAt: string;
            /** Format: int64 */
            occurrenceCount: number;
            routeCode: string;
            /** @enum {string} */
            source: "VUE" | "WINDOW" | "REJECTION";
        };
        BrowserErrorInput: {
            /** @description 소비 앱에 설정한 현재 release version과 정확히 일치해야 합니다. */
            appVersion: string;
            /** Format: uuid */
            clientEventId: string;
            /** @enum {string} */
            componentCode: "ROOT";
            /** @enum {string} */
            eventCode: "VUE_ERROR" | "WINDOW_ERROR" | "UNHANDLED_REJECTION" | "UNKNOWN_RUNTIME";
            routeCode: string;
            /**
             * Format: int32
             * @enum {integer}
             */
            schemaVersion: 1;
            /** @enum {string} */
            source: "VUE" | "WINDOW" | "REJECTION";
        };
        BrowserErrorOccurrencePage: {
            items: components["schemas"]["BrowserErrorOccurrenceResponse"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        BrowserErrorOccurrenceResponse: {
            /** Format: int64 */
            actorId: number | null;
            actorSubject: string;
            /** Format: int64 */
            groupId: number;
            /** Format: int64 */
            id: number;
            /** Format: date-time */
            occurredAt: string;
            requestId: string | null;
        };
        CsrfResponse: {
            headerName: string;
            token: string;
        };
        EmptyCommand: unknown;
        FieldViolation: {
            field: string;
            message: string;
        };
        /** @description 현재 서버에서 활성화한 선택 기능 */
        FrameworkCapabilities: {
            browserErrors: boolean;
            messaging: boolean;
            observability: boolean;
            scheduler: boolean;
        };
        HealthResponse: {
            application: string;
            status: string;
        };
        OperationMessageItem: {
            /** Format: date-time */
            completedAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: int32 */
            dispatchAttempts: number;
            /** Format: uuid */
            eventId: string;
            lastFailureCode: string | null;
            /** Format: date-time */
            nextAttemptAt: string;
            /** Format: date-time */
            publishedAt: string | null;
            /** @enum {string} */
            state: "PENDING" | "CLAIMED" | "PUBLISHED" | "COMPLETED" | "DEAD";
            /** @enum {string} */
            type: "SECURITY_AUDIT" | "FILE_DELETE" | "MESSAGE_DEMO";
        };
        OperationMessagePage: {
            items: components["schemas"]["OperationMessageItem"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        OperationalRegisteredJobResponse: {
            /** @enum {string} */
            executionMode: "TRANSACTIONAL" | "NON_TRANSACTIONAL";
            jobCode: string;
        };
        OperationalRegisteredJobsResponse: {
            items: components["schemas"]["OperationalRegisteredJobResponse"][];
        };
        OperationalRunPage: {
            items: components["schemas"]["OperationalRunResponse"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        OperationalRunResponse: {
            /** Format: int32 */
            attempt: number;
            /** Format: date-time */
            completedAt: string | null;
            /** Format: int64 */
            id: number;
            jobCode: string;
            reasonCode: string | null;
            /** Format: uuid */
            runKey: string;
            /** Format: int64 */
            scheduleId: number;
            /** Format: date-time */
            scheduledAt: string;
            /** Format: date-time */
            startedAt: string;
            /** @enum {string} */
            state: "RUNNING" | "SUCCESS" | "FAILED";
        };
        OperationalScheduleInput: {
            /** @description Quartz cron. seconds 필드는 0만 허용합니다. */
            cron: string;
            enabled: boolean;
            jobCode: string;
            /** @enum {string} */
            misfirePolicy: "SKIP" | "FIRE_ONCE";
            timeZone: string;
        };
        OperationalSchedulePage: {
            items: components["schemas"]["OperationalScheduleResponse"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        OperationalScheduleResponse: {
            /** Format: date-time */
            createdAt: string;
            cron: string;
            enabled: boolean;
            /** Format: int64 */
            id: number;
            jobCode: string;
            /** @enum {string} */
            misfirePolicy: "SKIP" | "FIRE_ONCE";
            /** Format: date-time */
            nextFireAt: string | null;
            /** Format: int32 */
            revision: number;
            timeZone: string;
            /** Format: date-time */
            updatedAt: string;
        };
        OperationalScheduleRevisionInput: {
            /** Format: int32 */
            revision: number;
        };
        OperationalScheduleUpdateInput: {
            cron: string;
            enabled: boolean;
            jobCode: string;
            /** @enum {string} */
            misfirePolicy: "SKIP" | "FIRE_ONCE";
            /** Format: int32 */
            revision: number;
            timeZone: string;
        };
        SessionResponse: {
            roles: string[];
            username: string;
        };
        StoredBlob: {
            key?: string;
            /** Format: int64 */
            size?: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    csrf: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CsrfResponse"];
                };
            };
        };
    };
    me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["SessionResponse"];
                };
            };
        };
    };
    capabilities: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["FrameworkCapabilities"];
                };
            };
        };
    };
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 초기 준비 완료 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["HealthResponse"];
                };
            };
            /** @description 초기 준비 중 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    scOperations_post_browser_errors: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BrowserErrorInput"];
            };
        };
        responses: {
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["BrowserErrorAccepted"];
                };
            };
        };
    };
    scOperations_get_browser_errors_groups: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                source?: string;
                eventCode?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["BrowserErrorGroupPage"];
                };
            };
        };
    };
    scOperations_get_browser_errors_groups_id_occurrences: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["BrowserErrorOccurrencePage"];
                };
            };
        };
    };
    scOperations_get_jobs_registered: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalRegisteredJobsResponse"];
                };
            };
        };
    };
    scOperations_get_jobs_runs: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                scheduleId?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalRunPage"];
                };
            };
        };
    };
    scOperations_get_jobs_schedules: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalSchedulePage"];
                };
            };
        };
    };
    scOperations_post_jobs_schedules: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OperationalScheduleInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalScheduleResponse"];
                };
            };
        };
    };
    scOperations_get_jobs_schedules_id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalScheduleResponse"];
                };
            };
        };
    };
    scOperations_put_jobs_schedules_id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OperationalScheduleUpdateInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalScheduleResponse"];
                };
            };
        };
    };
    scOperations_post_jobs_schedules_id_pause: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OperationalScheduleRevisionInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalScheduleResponse"];
                };
            };
        };
    };
    scOperations_post_jobs_schedules_id_resume: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OperationalScheduleRevisionInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationalScheduleResponse"];
                };
            };
        };
    };
    scOperations_get_messages: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                type?: string;
                state?: "PENDING" | "CLAIMED" | "PUBLISHED" | "COMPLETED" | "DEAD";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationMessagePage"];
                };
            };
        };
    };
    scOperations_post_messages_demo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["EmptyCommand"];
            };
        };
        responses: {
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationMessageItem"];
                };
            };
        };
    };
    scOperations_post_messages_eventId_retry: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["EmptyCommand"];
            };
        };
        responses: {
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OperationMessageItem"];
                };
            };
        };
    };
    upload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["StoredBlob"];
                };
            };
        };
    };
    download: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
