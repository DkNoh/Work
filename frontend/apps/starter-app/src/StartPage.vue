<template>
  <section class="sc-content sc-stack starter-page" aria-labelledby="starter-heading">
    <header>
      <p class="starter-eyebrow">Starter / 프로젝트 시작</p>
      <h1 id="starter-heading">새 프로젝트 시작</h1>
      <p class="starter-description">
        공통 화면과 서버 연결을 확인하고 프로젝트 제목을 입력하세요.
      </p>
    </header>
    <sc-section-card
      title="ScFramework Starter"
      description="공통 구성으로 새 프로젝트를 시작하세요."
      density="compact"
    >
      <div class="sc-stack">
        <sc-text-field v-model="projectTitle" label="프로젝트 제목" density="compact" />
        <p>
          시작할 프로젝트:
          <strong>{{ projectTitle || "제목을 입력해 주세요" }}</strong>
        </p>
        <v-alert v-if="health.isSuccess.value" type="success" role="status">
          서버 상태: {{ health.data.value?.status }}
        </v-alert>
        <v-alert v-else-if="health.isError.value" type="error" role="alert">
          {{ health.error.value?.message }}
        </v-alert>
        <p v-else role="status">서버 연결 확인 중…</p>
        <sc-action-button
          size="sm"
          :icon-path="mdiRefresh"
          :busy="health.isFetching.value"
          busy-label="확인 중…"
          @click="health.refetch()"
        >
          서버 상태 다시 확인
        </sc-action-button>
      </div>
    </sc-section-card>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공통 입력·버튼·카드를 조립하고 health의 로딩/오류/결과를 표시한다. 버튼은 health Query를 명시적으로 다시 조회한다.
 */

/**
 * 공통 패키지만 사용하는 최소 시작 화면이다. projectTitle은 브라우저 입력 예제이며 API에 저장되지 않는다.
 * 서버 상태는 useQuery가 /health 응답을 보관한다. queryFn의 AbortSignal을 runtime.client에 전달하여 조회 취소를 연결한다.
 * script의 ref는 .value로 읽지만 template의 최상위 ref는 자동 해제된다. computed가 필요한 파생값은 별도 복사 상태로 만들지 않는다.
 */

import { ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { mdiRefresh } from "@mdi/js";
import { ScActionButton, ScSectionCard, ScTextField } from "@sc/ui";
import { useFrameworkRuntime } from "@sc/runtime";

const runtime = useFrameworkRuntime();
const projectTitle = ref("");
const health = useQuery({
  queryKey: ["health"],
  queryFn: ({ signal }) =>
    runtime.client.request<{ status: string }>("/health", "GET", undefined, { signal }),
});
</script>

<style scoped lang="scss">
.starter-page {
  max-width: 960px;
}
.starter-eyebrow {
  color: var(--sc-color-primary);
  font-size: var(--sc-font-size-small);
  font-weight: 700;
}
.starter-page h1 {
  margin-block: var(--sc-space-2);
  font-size: var(--sc-font-size-title);
  line-height: var(--sc-line-height-title);
}
.starter-description {
  color: var(--sc-color-text-muted);
}
</style>
