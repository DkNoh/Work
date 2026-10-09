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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
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
        EchoResponse: {
            message: string;
        };
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
        RequirementAdoResponse: {
            linkedAt?: string;
            /** Format: int64 */
            linkedBy?: number;
            linkedByName?: string;
            ticket?: string;
            url?: string;
        };
        RequirementAnnotationResponse: {
            /** Format: double */
            height?: number;
            /** Format: int64 */
            id?: number;
            /** Format: int32 */
            number?: number;
            /** Format: int64 */
            requirementId?: number;
            /** Format: int64 */
            screenVersionId?: number;
            /** Format: double */
            width?: number;
            /** Format: double */
            x?: number;
            /** Format: double */
            y?: number;
        };
        RequirementAttachmentResponse: {
            createdAt?: string;
            /** Format: int64 */
            fileId?: number;
            /** Format: int64 */
            id?: number;
            mime?: string;
            originalName?: string;
            /** Format: int64 */
            size?: number;
        };
        /** @description 007 일반 요청에서는 null만 지원한다. 이미지 좌표 기능은 010 범위다. */
        RequirementBoxInput: {
            /** Format: double */
            height?: number;
            /** Format: double */
            width?: number;
            /** Format: double */
            x?: number;
            /** Format: double */
            y?: number;
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
        RequirementRevisionInput: {
            /** Format: int32 */
            revision: number;
        };
        RequirementScreenVersionResponse: {
            /** Format: int32 */
            archived?: number;
            createdAt?: string;
            /** Format: int64 */
            createdBy?: number;
            createdByName?: string;
            /** Format: int64 */
            fileId?: number;
            /** Format: int32 */
            height?: number;
            /** Format: int64 */
            id?: number;
            /** Format: int64 */
            screenId?: number;
            /** Format: int32 */
            version?: number;
            /** Format: int32 */
            width?: number;
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
}
