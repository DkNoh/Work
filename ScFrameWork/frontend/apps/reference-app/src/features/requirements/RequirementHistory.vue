<template>
  <ol class="history-list" :aria-label="t('request.history')">
    <li v-for="entry in history" :key="entry.id">
      <p>{{ entry.action }} · {{ entry.actorName }} · {{ formatDate(entry.createdAt) }}</p>
      <details>
        <summary>{{ t("request.snapshot") }}</summary>
        <h3>{{ t("request.before") }}</h3>
        <pre>{{ prettySnapshot(entry.beforeJson) }}</pre>
        <h3>{{ t("request.after") }}</h3>
        <pre>{{ prettySnapshot(entry.afterJson) }}</pre>
      </details>
    </li>
  </ol>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 이력 항목을 id로 반복하고 native details로 저장 전/후 스냅샷을 펼친다. 보간 {{ }}는 JSON을 HTML이 아닌 텍스트로 표시한다.
 */

// 요구사항 이력의 읽기 전용 표시 컴포넌트다. 조회/권한/변경은 부모와 서버가 맡으며 이 파일은 API를 호출하지 않는다.
import { useI18n } from "vue-i18n";
import type { RequirementDetail } from "./api";
// RequirementDetail["history"]는 상세 DTO 안의 history 필드 타입을 재사용한다. formatDate 함수도 부모가 내려 주어 같은 시간대 표시를 쓴다.
defineProps<{
  history: RequirementDetail["history"];
  formatDate: (value: string | null) => string;
}>();
const { t } = useI18n({ useScope: "global" });
// nullable JSON 문자열을 보기 좋게 들여쓴다. null은 대시, 파싱 실패는 원문으로 표시해 불완전한 과거 기록도 화면을 깨지 않게 한다.
function prettySnapshot(raw: string | null) {
  if (raw === null) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
</script>

<style scoped>
.history-list {
  margin: 0;
  padding-left: var(--sc-space-6);
}
summary {
  min-height: 44px;
  display: list-item;
  align-content: center;
  cursor: pointer;
}
pre {
  max-width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--sc-font-size-small);
}
</style>
