# 공개 image digest를 고정한다. 실제 image 실행 검증은 docs/검증의 012 기록을 따른다.
FROM node:24.16.0-bookworm-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203 AS frontend-build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY frontend ./frontend
COPY scripts ./scripts
COPY docs ./docs
COPY .prettierrc.json .prettierignore ./
RUN npm install --global npm@11.13.0 && npm ci --no-audit --no-fund && npm run build

FROM eclipse-temurin:21-jdk-noble@sha256:b468c3fc688b14450571494f588bd939378e7fd542ed5a73f8efc13f17872a87 AS java-build
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends curl python3 && rm -rf /var/lib/apt/lists/*
COPY backend ./backend
COPY --from=frontend-build /workspace/frontend ./frontend
RUN chmod +x backend/mvnw && backend/mvnw -B -f backend/pom.xml clean verify

FROM eclipse-temurin:21-jre-noble@sha256:000fd431958bc81a24abe1e8e5f0f0fd3ae365a594bd50aadb20696805f9408c AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends gosu curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=java-build /workspace/backend/reference-app/target/sc-reference-app.jar /app/application.jar
COPY scripts/docker-entrypoint.sh /app/entrypoint.sh
COPY scripts/clean-env.sh /app/clean-env.sh
RUN chmod 755 /app/entrypoint.sh
ENV SC_ADDRESS=0.0.0.0 SC_PORT=18082 SC_DB_URL=jdbc:h2:file:/app/data/sc-reference;DB_CLOSE_ON_EXIT=FALSE SC_LOG_FILE=/app/logs/application.log
ENV SC_UPLOAD_DIR=/app/uploads
ENV SC_XMS=128m SC_XMX=384m
EXPOSE 18082
ENTRYPOINT ["/app/entrypoint.sh"]
