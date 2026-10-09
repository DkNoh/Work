<template>
  <sc-section-card :title="t('kanban.members')">
    <ul class="kanban-members">
      <li v-for="member in members" :key="member.id">
        <sc-checkbox
          :model-value="member.kanbanAccess"
          :label="`${member.displayName}: ${t('kanban.access')}`"
          :disabled="busy || member.role === 'ADMIN'"
          @update:model-value="emit('change', member.id, $event)"
        />
      </li>
    </ul>
  </sc-section-card>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * model-value는 부모의 서버 응답을 읽고 update:model-value는 change 이벤트로 위임한다. 체크박스로 props 멤버 객체를 직접 수정하지 않는다.
 */

// 관리자의 칸반 접근 허용 목록 표시다. 이 컴포넌트는 API를 호출하지 않고 부모 changeMember → API → Query 갱신 결과를 기다린다.
import { useI18n } from "vue-i18n";
import { ScCheckbox, ScSectionCard } from "@sc/ui";
import type { KanbanMember } from "./api";
import { kanbanMessages } from "./messages";
// readonly 배열은 정적 불변 계약이다. busy일 때 변경을 막고 ADMIN 행은 항상 별도 비활성 표시한다.
defineProps<{ members: readonly KanbanMember[]; busy: boolean }>();
// change 이벤트의 두 인수는 사용자 id와 허용 boolean이다. template의 $event는 공통 Checkbox가 emit한 새 값이다.
const emit = defineEmits<{ change: [id: number, allowed: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
</script>
<style scoped>
.kanban-members {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sc-space-3);
}
</style>
