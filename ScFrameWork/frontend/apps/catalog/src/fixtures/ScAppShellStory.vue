<template>
  <sc-app-shell
    :application-title="applicationTitle"
    :application-label="applicationLabel"
    :navigation-label="navigationLabel"
    :navigation-items="navigationItems"
    :active-item="selectedItem"
    @navigate="selectScreen"
  >
    <template #header-actions>
      <div class="sc-shell-story__header-tools">
        <div class="sc-shell-story__header-buttons">
          <sc-action-button variant="text" @click="refreshCount += 1">새로고침</sc-action-button>
          <sc-action-button
            variant="text"
            :aria-expanded="showHeaderTools"
            :aria-controls="headerToolsId"
            @click="showHeaderTools = !showHeaderTools"
          >
            {{ showHeaderTools ? "도구 영역 접기" : "도구 영역 펼치기" }}
          </sc-action-button>
        </div>
        <div v-show="showHeaderTools" :id="headerToolsId" class="sc-shell-story__expanded-tools">
          <p>추가 조회 도구를 펼치면 실제 헤더의 높이가 늘어납니다.</p>
          <p>탐색 영역의 시작 위치도 측정한 높이에 맞춰 이동합니다.</p>
        </div>
      </div>
    </template>
    <template #sidebar-footer>공통 UI 카탈로그 · 합성 화면</template>
    <template v-if="notice" #notice>
      <p class="sc-shell-story__notice" role="status">{{ notice }}</p>
    </template>
    <section class="sc-content sc-stack" aria-label="화면 본문 예제">
      <header class="sc-stack">
        <p class="sc-shell-story__eyebrow">ScFramework · {{ selectedLabel }}</p>
        <h1>{{ pageTitle }}</h1>
        <p class="sc-shell-story__description">
          공통 셸은 탐색과 배치만 담당합니다. 화면의 조회·입력·권한과 API는 앱이 소유합니다.
        </p>
      </header>
      <div class="sc-shell-story__cards">
        <v-card>
          <v-card-title>입력과 조회</v-card-title>
          <v-card-text class="sc-stack">
            <p>업무 제목을 수정해도 탐색 상태와 별도로 유지합니다.</p>
            <sc-text-field v-model="title" label="업무 제목" />
          </v-card-text>
        </v-card>
        <v-card>
          <v-card-title>조작 상태</v-card-title>
          <v-card-text class="sc-stack">
            <p role="status" aria-label="선택한 화면">{{ selectedLabel }}</p>
            <p role="status" aria-label="새로고침 횟수">새로고침 {{ refreshCount }}회</p>
            <p>동작 이름·현재 위치·입력 label은 한국어로 표시합니다.</p>
          </v-card-text>
        </v-card>
      </div>
    </section>
  </sc-app-shell>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { VCard, VCardTitle, VCardText } from "vuetify/components";
import { ScAppShell, ScActionButton, ScTextField, type ScAppShellNavItem } from "@sc/ui";

const props = withDefaults(
  defineProps<{
    applicationTitle?: string;
    applicationLabel?: string;
    navigationLabel?: string;
    navigationItems?: readonly ScAppShellNavItem[];
    activeItem?: string;
    pageTitle?: string;
    notice?: string;
  }>(),
  {
    applicationTitle: "ScFramework",
    applicationLabel: "신규 업무 앱",
    navigationLabel: "화면 탐색",
    navigationItems: () => [
      { id: "examples", label: "예제 업무", href: "#examples" },
      { id: "reports", label: "조회 보고서", href: "#reports" },
      { id: "settings", label: "설정", href: "#settings" },
    ],
    activeItem: "examples",
    pageTitle: "업무 목록과 입력",
    notice: "",
  },
);
const selectedItem = ref(props.activeItem);
const emit = defineEmits<{ navigate: [item: ScAppShellNavItem] }>();
const selectedLabel = computed(
  () => props.navigationItems.find((item) => item.id === selectedItem.value)?.label ?? "업무",
);
const title = ref("긴 한국어 제목도 입력과 조작 이름을 유지합니다");
const refreshCount = ref(0);
const showHeaderTools = ref(false);
const headerToolsId = `sc-story-header-tools-${useId()}`;
watch(
  () => props.activeItem,
  (value) => {
    selectedItem.value = value;
  },
);
function selectScreen(item: ScAppShellNavItem) {
  selectedItem.value = item.id;
  emit("navigate", item);
}
</script>

<style scoped lang="scss">
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);

.sc-shell-story__eyebrow {
  color: var(--sc-color-text-muted);
  font-size: var(--sc-font-size-small);
  font-weight: var(--sc-font-weight-semibold);
}
.sc-shell-story__description {
  color: var(--sc-color-text-muted);
}
.sc-shell-story__header-tools {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--sc-space-2);
  max-width: 260px;
}
.sc-shell-story__header-buttons {
  display: flex;
  gap: var(--sc-space-1);
}
.sc-shell-story__expanded-tools {
  width: 100%;
  padding: var(--sc-space-3);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface-muted);
  color: var(--sc-color-text-muted);
  font-size: var(--sc-font-size-small);
}
.sc-shell-story__expanded-tools p {
  margin: 0;
  overflow-wrap: anywhere;
}
.sc-shell-story__expanded-tools p + p {
  margin-top: var(--sc-space-3);
}
.sc-shell-story__cards {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: var(--sc-space-6);
}
.sc-shell-story__notice {
  margin: 0;
  padding: var(--sc-space-3) var(--sc-space-4);
  border-left: 3px solid var(--sc-color-warning);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface);
}
@media (max-width: tokens.$sc-breakpoint-sm - 1px) {
  .sc-shell-story__cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
