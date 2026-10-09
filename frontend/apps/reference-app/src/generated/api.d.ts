export interface paths {
    "/api/audit/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 보안 감사 조회
         * @description 현재 DB ADMIN만 접근하는 신규 감사 API. 최신 시각/ID순이며 본문·암호·토큰을 반환하지 않습니다.
         */
        get: operations["events"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
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
        get: operations["me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["documents"];
        put?: never;
        post: operations["createDocument"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/documents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["document"];
        put: operations["updateDocument"];
        post?: never;
        delete: operations["deleteDocument"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/examples": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 중립 예제 목록: 단순 조회는 JPA */
        get: operations["list_3"];
        put?: never;
        /** 예제 생성 */
        post: operations["create_3"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/examples/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** MyBatis 읽기 연결 예제 */
        get: operations["summary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/examples/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** revision을 확인하여 예제 수정 */
        put: operations["update_2"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/files/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["file"];
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
    "/api/integration/echo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** OpenFeign 외부 HTTP 연결 예제 */
        get: operations["echo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanAccess"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/boards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanBoards"];
        put?: never;
        post: operations["createKanbanBoard"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/boards/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["renameKanbanBoard"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/members/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["updateKanbanMember"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/notices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanNotices"];
        put?: never;
        post: operations["createKanbanNotice"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/notices/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanNotice"];
        put: operations["updateKanbanNotice"];
        post?: never;
        delete: operations["deleteKanbanNotice"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanTasks"];
        put?: never;
        post: operations["createKanbanTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/tasks/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importKanbanTasks"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/tasks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanTask"];
        put: operations["updateKanbanTask"];
        post?: never;
        delete: operations["deleteKanbanTask"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/tasks/{id}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["moveKanbanTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/kanban/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["kanbanUsers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/menus": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_2"];
        put?: never;
        post: operations["create_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/menus/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["update_1"];
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
    "/api/reports/requirements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 요구사항 집계 보고서 조회 */
        get: operations["requirementReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_1"];
        put?: never;
        post: operations["create_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["detail"];
        put: operations["update"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/ado": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["ado"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/agree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["agree"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/annotation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["annotation"];
        post?: never;
        delete: operations["deleteAnnotation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/assignee": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["assign"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["attachment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["deleteAttachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["comment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["export"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["review"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/requirements/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["submit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/screens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["screens"];
        put?: never;
        post: operations["screen"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/screens/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["versions"];
        put?: never;
        post: operations["version"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list"];
        put?: never;
        post: operations["create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/versions/{id}/annotations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["annotations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/versions/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["archive"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AdoInput: {
            /** Format: int32 */
            revision: number;
            ticket: string;
            url: string;
        };
        AnnotationInput: {
            box: components["schemas"]["RequirementBoxInput"];
            /** Format: int32 */
            revision: number;
        };
        ApiError: {
            code?: string;
            errors?: components["schemas"]["FieldViolation"][];
            message?: string;
        };
        AssigneeInput: {
            /** Format: int64 */
            reviewerId?: number | null;
            /** Format: int32 */
            revision: number;
        };
        AuditItem: {
            action: string;
            /** Format: int64 */
            actorId: number | null;
            actorSubject: string;
            /** Format: int64 */
            id: number;
            /** Format: date-time */
            occurredAt: string;
            /** @enum {string} */
            outcome: "SUCCESS" | "FAILURE" | "DENIED";
            reasonCode: string | null;
            requestId: string | null;
            resourceId: string | null;
            resourceType: string;
        };
        AuditPage: {
            items: components["schemas"]["AuditItem"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        BoardInput: {
            title: string;
        };
        BoardRenameInput: {
            /** Format: int32 */
            revision: number;
            title: string;
        };
        BoardResponse: {
            /** Format: int64 */
            authorId: number | null;
            authorName: string | null;
            authorUsername: string | null;
            canRename: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            revision: number;
            title: string;
            /** Format: date-time */
            updatedAt: string;
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
        CommentInput: {
            body: string;
        };
        CommentResponse: {
            /** Format: int64 */
            authorId: number;
            authorName: string;
            body: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            id: number;
        };
        CreateExample: {
            title: string;
        };
        CsrfResponse: {
            headerName: string;
            token: string;
        };
        DocumentInput: {
            documentJson: string;
            title: string;
        };
        DocumentResponse: {
            /** Format: int64 */
            authorId: number;
            authorName: string;
            /** Format: date-time */
            createdAt: string;
            /** @description ScRichTextEditor가 검증한 doc JSON 문자열이며 HTML이 아니다. */
            documentJson: string;
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            revision: number;
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        DocumentSummary: {
            /** Format: int64 */
            authorId: number;
            authorName: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            revision: number;
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        DocumentUpdateInput: {
            documentJson: string;
            /** Format: int32 */
            revision: number;
            title: string;
        };
        EchoResponse: {
            message: string;
        };
        EmptyCommand: unknown;
        ExampleDto: {
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            revision: number;
            title: string;
        };
        ExamplePage: {
            items: components["schemas"]["ExampleDto"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        ExampleSummary: {
            /** Format: int64 */
            total: number;
        };
        FieldViolation: {
            field?: string;
            message?: string;
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
        HistoryResponse: {
            action: string;
            /** Format: int64 */
            actorId: number;
            actorName: string;
            afterJson: string;
            beforeJson: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            id: number;
        };
        KanbanAccessResponse: {
            allowed: boolean;
        };
        KanbanMemberInput: {
            allowed: boolean;
        };
        KanbanMemberResponse: {
            displayName: string;
            /** Format: int64 */
            id: number;
            kanbanAccess: boolean;
            role: string;
            username: string;
        };
        KanbanUserResponse: {
            displayName: string;
            /** Format: int64 */
            id: number;
            role: string;
            username: string;
        };
        MenuEditInput: {
            active?: boolean;
            name: string;
            /** Format: int32 */
            sortOrder?: number;
        };
        MenuInput: {
            name: string;
            /** Format: int64 */
            parentId?: number;
            /** Format: int32 */
            sortOrder?: number;
        };
        MenuResponse: {
            /**
             * Format: int32
             * @enum {integer}
             */
            active: 0 | 1;
            /** Format: int64 */
            id: number;
            name: string;
            /** Format: int64 */
            parentId: number | null;
            /** Format: int32 */
            sortOrder: number;
        };
        NewUserInput: {
            displayName: string;
            password: string;
            role: string;
            username: string;
        };
        NoticeInput: {
            content: string;
            title: string;
        };
        NoticeResponse: {
            /** Format: int64 */
            authorId: number;
            authorName: string;
            authorUsername: string;
            content: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            revision: number;
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        NoticeUpdateInput: {
            content: string;
            /** Format: int32 */
            revision: number;
            title: string;
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
        PasswordInput: {
            currentPassword: string;
            newPassword: string;
        };
        RequirementAdoResponse: {
            /** Format: date-time */
            linkedAt: string;
            /** Format: int64 */
            linkedBy: number;
            linkedByName: string;
            ticket: string;
            url: string;
        };
        RequirementAnnotationResponse: {
            /** Format: double */
            height: number;
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            number: number;
            /** Format: int64 */
            requirementId: number;
            /** Format: int64 */
            screenVersionId: number;
            /** Format: double */
            width: number;
            /** Format: double */
            x: number;
            /** Format: double */
            y: number;
        };
        RequirementAttachmentResponse: {
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            fileId: number;
            /** Format: int64 */
            id: number;
            mime: string;
            originalName: string;
            /** Format: int64 */
            size: number;
        };
        /** @description 내장 EXIF 방향을 적용한 원본 이미지 기준 0~1 좌표. 원본 bytes는 보존하며 요청당 박스 하나. */
        RequirementBoxInput: {
            /** Format: double */
            height: number;
            /** Format: double */
            width: number;
            /** Format: double */
            x: number;
            /** Format: double */
            y: number;
        };
        RequirementDetail: {
            ado: components["schemas"]["RequirementAdoResponse"] | null;
            annotation: components["schemas"]["RequirementAnnotationResponse"] | null;
            /** Format: int64 */
            assignedReviewerId: number | null;
            assignedReviewerName: string | null;
            attachments: components["schemas"]["RequirementAttachmentResponse"][];
            /** Format: int64 */
            authorId: number;
            authorName: string;
            comments: components["schemas"]["CommentResponse"][];
            /** Format: date-time */
            createdAt: string;
            desired: string;
            followParts: string;
            history: components["schemas"]["HistoryResponse"][];
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            menuId: number;
            menuName: string;
            reason: string;
            referenceText: string;
            review: components["schemas"]["ReviewResponse"] | null;
            /** Format: int32 */
            revision: number;
            screenVersion: components["schemas"]["RequirementScreenVersionResponse"] | null;
            /** Format: int64 */
            screenVersionId: number | null;
            /**
             * Format: int32
             * @enum {integer}
             */
            similar: 0 | 1;
            /** @enum {string} */
            status: "DRAFT" | "REQUESTED" | "NEEDS_INFO" | "REVIEWING" | "AGREED" | "ADO_LINKED";
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        RequirementExport: {
            text: string;
        };
        RequirementInput: {
            annotation?: components["schemas"]["RequirementBoxInput"] | null;
            desired: string;
            followParts?: string;
            /** Format: int64 */
            menuId: number;
            reason: string;
            referenceText?: string;
            /** Format: int32 */
            revision: number;
            /** Format: int64 */
            screenVersionId?: number | null;
            similar?: boolean;
            title: string;
        };
        RequirementPage: {
            items: components["schemas"]["RequirementSummary"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        RequirementReportItem: {
            /** Format: int64 */
            assignedReviewerId: number | null;
            assignedReviewerName: string | null;
            /** Format: int64 */
            authorId: number;
            authorName: string;
            /** Format: int64 */
            commentCount: number;
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            historyCount: number;
            /** Format: int64 */
            id: number;
            /** Format: date-time */
            lastCommentAt: string | null;
            /** Format: int64 */
            menuId: number;
            menuName: string;
            reviewDecision: ("UNREVIEWED" | "POSSIBLE" | "CONDITIONAL" | "MORE_INFO" | "IMPOSSIBLE") | null;
            /** Format: int32 */
            revision: number;
            /** @enum {string} */
            status: "DRAFT" | "REQUESTED" | "NEEDS_INFO" | "REVIEWING" | "AGREED" | "ADO_LINKED";
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        RequirementReportPage: {
            items: components["schemas"]["RequirementReportItem"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            stats: components["schemas"]["RequirementReportStats"];
            /** Format: int64 */
            total: number;
        };
        /** @description 필터와 읽기 권한을 적용한 전체 결과의 상태 건수와 미지정 건수 */
        RequirementReportStats: {
            /** Format: int64 */
            ADO_LINKED: number;
            /** Format: int64 */
            AGREED: number;
            /** Format: int64 */
            DRAFT: number;
            /** Format: int64 */
            NEEDS_INFO: number;
            /** Format: int64 */
            REQUESTED: number;
            /** Format: int64 */
            REVIEWING: number;
            /** Format: int64 */
            unassigned: number;
        };
        RequirementRevisionInput: {
            /** Format: int32 */
            revision: number;
        };
        RequirementScreenVersionResponse: {
            /**
             * Format: int32
             * @enum {integer}
             */
            archived: 0 | 1;
            /** Format: date-time */
            createdAt: string;
            /** Format: int64 */
            createdBy: number;
            createdByName: string;
            /** Format: int64 */
            fileId: number;
            /** Format: int32 */
            height: number;
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            screenId: number;
            /** Format: int32 */
            version: number;
            /** Format: int32 */
            width: number;
        };
        RequirementSummary: {
            /** Format: int64 */
            assignedReviewerId: number | null;
            assignedReviewerName: string | null;
            /** Format: int64 */
            authorId: number;
            authorName: string;
            /** Format: date-time */
            createdAt: string;
            desired: string;
            followParts: string;
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            menuId: number;
            menuName: string;
            reason: string;
            referenceText: string;
            /** Format: int32 */
            revision: number;
            /** Format: int64 */
            screenVersionId: number | null;
            /**
             * Format: int32
             * @enum {integer}
             */
            similar: 0 | 1;
            /** @enum {string} */
            status: "DRAFT" | "REQUESTED" | "NEEDS_INFO" | "REVIEWING" | "AGREED" | "ADO_LINKED";
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ReviewInput: {
            acceptance: string;
            conditions: string;
            decision: string;
            estimate: string;
            exclusions: string;
            needsInfo?: boolean;
            rationale: string;
            /** Format: int32 */
            revision: number;
            scope: string;
        };
        ReviewResponse: {
            acceptance: string;
            conditions: string;
            /** @enum {string} */
            decision: "UNREVIEWED" | "POSSIBLE" | "CONDITIONAL" | "MORE_INFO" | "IMPOSSIBLE";
            /** @enum {string} */
            estimate: "UNKNOWN" | "SMALL" | "MEDIUM" | "LARGE";
            exclusions: string;
            rationale: string;
            /** Format: int64 */
            requirementId: number;
            /** Format: int64 */
            reviewerId: number;
            reviewerName: string;
            scope: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ScreenInput: {
            /** Format: int64 */
            menuId: number;
            name: string;
        };
        ScreenResponse: {
            /** Format: int64 */
            id: number;
            /** Format: int64 */
            menuId: number;
            name: string;
        };
        TaskCreateInput: {
            /** Format: int64 */
            assigneeId?: number | null;
            description?: string;
            /** Format: date */
            dueDate?: string | null;
            /** @enum {string} */
            priority: "LOW" | "MEDIUM" | "HIGH";
            /** @enum {string} */
            status: "TODO" | "IN_PROGRESS" | "DONE" | "REJECTED";
            tags?: string[];
            title: string;
        };
        /** @description 승인한 행만 새 작업으로 원자적으로 생성한다. 같은 성공 요청 재전송은 새 작업을 다시 만든다. */
        TaskImportInput: {
            /** Format: int64 */
            boardId: number;
            rows: components["schemas"]["TaskImportRow"][];
        };
        TaskImportResult: {
            /** Format: int32 */
            importedCount: number;
            items: components["schemas"]["TaskResponse"][];
        };
        TaskImportRow: {
            input: components["schemas"]["TaskCreateInput"];
            /** Format: int32 */
            rowNumber: number;
        };
        TaskInput: {
            /** Format: int64 */
            assigneeId?: number | null;
            /** Format: int64 */
            boardId?: number;
            description?: string;
            /** Format: date */
            dueDate?: string | null;
            /** @enum {string} */
            priority: "LOW" | "MEDIUM" | "HIGH";
            /** Format: int32 */
            revision?: number;
            /** @enum {string} */
            status: "TODO" | "IN_PROGRESS" | "DONE" | "REJECTED";
            tags?: string[];
            title: string;
        };
        TaskMoveInput: {
            /** Format: int64 */
            beforeId?: number | null;
            /** Format: int32 */
            revision: number;
            /** @enum {string} */
            status: "TODO" | "IN_PROGRESS" | "DONE" | "REJECTED";
        };
        TaskResponse: {
            /** Format: int64 */
            assigneeId: number | null;
            assigneeName: string | null;
            assigneeUsername: string | null;
            /** Format: int64 */
            authorId: number;
            authorName: string;
            authorUsername: string;
            /** Format: int64 */
            boardId: number;
            /** Format: date-time */
            completedAt: string | null;
            /** Format: date-time */
            createdAt: string;
            description: string;
            /** Format: date */
            dueDate: string | null;
            /** Format: int64 */
            id: number;
            /** Format: double */
            position: number;
            /** @enum {string} */
            priority: "LOW" | "MEDIUM" | "HIGH";
            /** Format: int32 */
            revision: number;
            /** @enum {string} */
            status: "TODO" | "IN_PROGRESS" | "DONE" | "REJECTED";
            tags: string[];
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        UpdateExample: {
            /** Format: int32 */
            revision: number;
            title: string;
        };
        UserResponse: {
            displayName: string;
            /** Format: int64 */
            id: number;
            /** @enum {string} */
            role: "REQUESTER" | "REVIEWER" | "ADMIN";
            username: string;
        };
        VersionAnnotationResponse: {
            /** Format: int64 */
            authorId: number;
            /** Format: double */
            height: number;
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            number: number;
            /** Format: int64 */
            requirementId: number;
            /** Format: int32 */
            revision: number;
            /** Format: int64 */
            screenVersionId: number;
            title: string;
            /** Format: double */
            width: number;
            /** Format: double */
            x: number;
            /** Format: double */
            y: number;
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
    events: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                action?: string;
                outcome?: string;
                actorSubject?: string;
                from?: string;
                to?: string;
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
                    "*/*": components["schemas"]["AuditPage"];
                };
            };
        };
    };
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
                    "*/*": components["schemas"]["UserResponse"];
                };
            };
        };
    };
    password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    documents: {
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
                    "*/*": components["schemas"]["DocumentSummary"][];
                };
            };
        };
    };
    createDocument: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DocumentInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["DocumentResponse"];
                };
            };
        };
    };
    document: {
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
                    "*/*": components["schemas"]["DocumentResponse"];
                };
            };
        };
    };
    updateDocument: {
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
                "application/json": components["schemas"]["DocumentUpdateInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["DocumentResponse"];
                };
            };
        };
    };
    deleteDocument: {
        parameters: {
            query: {
                revision: number;
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
                content?: never;
            };
        };
    };
    list_3: {
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
                    "*/*": components["schemas"]["ExamplePage"];
                };
            };
        };
    };
    create_3: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateExample"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["ExampleDto"];
                };
            };
            /** @description 입력 오류 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["ApiError"];
                };
            };
        };
    };
    summary: {
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
                    "*/*": components["schemas"]["ExampleSummary"];
                };
            };
        };
    };
    update_2: {
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
                "application/json": components["schemas"]["UpdateExample"];
            };
        };
        responses: {
            /** @description 낙관적 잠금 충돌 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["ApiError"];
                };
            };
        };
    };
    file: {
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
                    "*/*": string;
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
    echo: {
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
                    "*/*": components["schemas"]["EchoResponse"];
                };
            };
        };
    };
    kanbanAccess: {
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
                    "*/*": components["schemas"]["KanbanAccessResponse"];
                };
            };
        };
    };
    kanbanBoards: {
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
                    "*/*": components["schemas"]["BoardResponse"][];
                };
            };
        };
    };
    createKanbanBoard: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BoardInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["BoardResponse"];
                };
            };
        };
    };
    renameKanbanBoard: {
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
                "application/json": components["schemas"]["BoardRenameInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["BoardResponse"];
                };
            };
        };
    };
    kanbanMembers: {
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
                    "*/*": components["schemas"]["KanbanMemberResponse"][];
                };
            };
        };
    };
    updateKanbanMember: {
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
                "application/json": components["schemas"]["KanbanMemberInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["KanbanMemberResponse"];
                };
            };
        };
    };
    kanbanNotices: {
        parameters: {
            query?: {
                q?: string;
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
                    "*/*": components["schemas"]["NoticeResponse"][];
                };
            };
        };
    };
    createKanbanNotice: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NoticeInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["NoticeResponse"];
                };
            };
        };
    };
    kanbanNotice: {
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
                    "*/*": components["schemas"]["NoticeResponse"];
                };
            };
        };
    };
    updateKanbanNotice: {
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
                "application/json": components["schemas"]["NoticeUpdateInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["NoticeResponse"];
                };
            };
        };
    };
    deleteKanbanNotice: {
        parameters: {
            query: {
                revision: number;
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
                content?: never;
            };
        };
    };
    kanbanTasks: {
        parameters: {
            query?: {
                q?: string;
                status?: "TODO" | "IN_PROGRESS" | "DONE" | "REJECTED";
                priority?: "LOW" | "MEDIUM" | "HIGH";
                assigneeId?: number;
                view?: "ALL" | "CREATED" | "ASSIGNED";
                boardId?: number;
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
                    "*/*": components["schemas"]["TaskResponse"][];
                };
            };
        };
    };
    createKanbanTask: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["TaskResponse"];
                };
            };
        };
    };
    importKanbanTasks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskImportInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["TaskImportResult"];
                };
            };
        };
    };
    kanbanTask: {
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
                    "*/*": components["schemas"]["TaskResponse"];
                };
            };
        };
    };
    updateKanbanTask: {
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
                "application/json": components["schemas"]["TaskInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["TaskResponse"];
                };
            };
        };
    };
    deleteKanbanTask: {
        parameters: {
            query: {
                revision: number;
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
                content?: never;
            };
        };
    };
    moveKanbanTask: {
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
                "application/json": components["schemas"]["TaskMoveInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["TaskResponse"];
                };
            };
        };
    };
    kanbanUsers: {
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
                    "*/*": components["schemas"]["KanbanUserResponse"][];
                };
            };
        };
    };
    list_2: {
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
                    "*/*": components["schemas"]["MenuResponse"][];
                };
            };
        };
    };
    create_2: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MenuInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["MenuResponse"];
                };
            };
        };
    };
    update_1: {
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
                "application/json": components["schemas"]["MenuEditInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["MenuResponse"];
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
    requirementReport: {
        parameters: {
            query?: {
                /** @description 제목의 literal 부분 문자열, 앞뒤 공백 보존 */
                q?: string;
                menuId?: number;
                status?: string;
                authorId?: number;
                screenVersionId?: number;
                page?: number;
                size?: number;
                /** @description 생략 시 최근 수정/ID 내림차순 */
                sort?: "updatedAt" | "title" | "commentCount" | "historyCount" | "lastCommentAt";
                /** @description sort를 지정한 경우에만 사용, 생략 시 desc */
                direction?: "asc" | "desc";
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
                    "*/*": components["schemas"]["RequirementReportPage"];
                };
            };
        };
    };
    list_1: {
        parameters: {
            query?: {
                q?: string;
                menuId?: number;
                status?: string;
                authorId?: number;
                screenVersionId?: number;
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
                    "*/*": components["schemas"]["RequirementPage"];
                };
            };
        };
    };
    create_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RequirementInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    detail: {
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
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    update: {
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
                "application/json": components["schemas"]["RequirementInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    ado: {
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
                "application/json": components["schemas"]["AdoInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    agree: {
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
                "application/json": components["schemas"]["RequirementRevisionInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    annotation: {
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
                "application/json": components["schemas"]["AnnotationInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    deleteAnnotation: {
        parameters: {
            query: {
                revision: number;
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
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    assign: {
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
                "application/json": components["schemas"]["AssigneeInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    attachment: {
        parameters: {
            query: {
                revision: number;
            };
            header?: never;
            path: {
                id: number;
            };
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
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    deleteAttachment: {
        parameters: {
            query: {
                revision: number;
            };
            header?: never;
            path: {
                id: number;
                attachmentId: number;
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
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    comment: {
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
                "application/json": components["schemas"]["CommentInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    export: {
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
                    "*/*": components["schemas"]["RequirementExport"];
                };
            };
        };
    };
    review: {
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
                "application/json": components["schemas"]["ReviewInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    submit: {
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
                "application/json": components["schemas"]["RequirementRevisionInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["RequirementDetail"];
                };
            };
        };
    };
    screens: {
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
                    "*/*": components["schemas"]["ScreenResponse"][];
                };
            };
        };
    };
    screen: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ScreenInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["ScreenResponse"];
                };
            };
        };
    };
    versions: {
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
                    "*/*": components["schemas"]["RequirementScreenVersionResponse"][];
                };
            };
        };
    };
    version: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
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
                    "*/*": components["schemas"]["RequirementScreenVersionResponse"];
                };
            };
        };
    };
    list: {
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
                    "*/*": components["schemas"]["UserResponse"][];
                };
            };
        };
    };
    create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NewUserInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["UserResponse"];
                };
            };
        };
    };
    annotations: {
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
                    "*/*": components["schemas"]["VersionAnnotationResponse"][];
                };
            };
        };
    };
    archive: {
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
                    "*/*": components["schemas"]["RequirementScreenVersionResponse"];
                };
            };
        };
    };
}
