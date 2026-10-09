<template>
  <sc-section-card v-if="initial?.screenVersion" :title="t('image')">
    <p>{{ t("version") }}: {{ initial.screenVersion.version }}</p>
    <p v-if="readonly">{{ t("readonly") }}</p>
    <sc-image-annotator
      v-model="box"
      :image="file.image.value"
      :image-description="`${t('image')} · ${t('version')} ${initial.screenVersion.version}`"
      :annotations="annotations"
      :selected-annotation-id="selected"
      :readonly="readonly"
      :disabled="busy || mismatch"
      :loading="file.loading.value"
      :error="mismatch ? t('mismatch') : file.error.value || annotationQuery.error.value?.message"
      :labels="labels"
      @retry="file.retry"
      @select-annotation="selected = $event"
    />
    <div v-if="!readonly" class="sc-inline">
      <sc-action-button
        :busy="busy"
        :disabled="!box || mismatch || file.loading.value"
        @click="saveBox"
      >
        {{ t("saveBox") }}
      </sc-action-button>
      <sc-action-button
        :disabled="busy || !initial.annotation"
        color="error"
        @click="deleteOpen = true"
      >
        {{ t("deleteBox") }}
      </sc-action-button>
    </div>
    <sc-confirm-dialog
      v-model="deleteOpen"
      :title="t('deleteBox')"
      :message="t('deleteBoxConfirm')"
      :busy="busy"
      :confirm-label="t('confirm')"
      :cancel-label="t('cancel')"
      @confirm="deleteBox"
    />
  </sc-section-card>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공통 이미지 편집기에 box와 읽기 전용 주석을 전달하고, 저장/삭제는 revision을 포함한 이벤트로 부모에게 알린다.
 */

/**
 * 기존 요구사항의 이미지 영역 수정/삭제 입력부. 조회는 Query, 편집 중 좌표는 box, 최초 비교 기준은 basis가 소유한다.
 * ScNormalizedBox는 픽셀 대신 0~1 상대 좌표의 타입이다. 화면 배율이 바뀌어도 같은 영역을 가리킨다.
 * props.initial을 직접 수정하지 않고 좌표 복사본을 편집한다. resetKey가 바뀔 때만 새 revision과 원본을 받아 초안을 교체한다.
 * 다른 요구사항의 주석은 읽기 전용 참고 목록으로 보여준다. 이미지 실제 크기가 서버 메타데이터와 다르면 저장을 막는다.
 */

import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { ScSectionCard, ScActionButton, ScConfirmDialog } from "@sc/ui";
import {
  ScImageAnnotator,
  isNormalizedBox,
  type ScNormalizedBox,
  type ScImageLabels,
} from "@sc/ui/image";
import { useReferenceRuntime } from "../../auth/identity";
import type { RequirementDetail } from "../requirements/api";
import { createMediaApi, mediaKeys } from "./api";
import { useImageFile } from "./useImageFile";
import { mediaMessages } from "./messages";
const props = defineProps<{
  initial: RequirementDetail | null;
  resetKey: number;
  busy: boolean;
  readonly: boolean;
}>();
const emit = defineEmits<{
  save: [input: { box: ScNormalizedBox; revision: number }];
  delete: [input: { revision: number }];
  "dirty-change": [dirty: boolean];
}>();
const { t, locale } = useI18n({ useScope: "local", messages: mediaMessages });
const runtime = useReferenceRuntime();
const api = createMediaApi(runtime);
const fileId = computed(() => props.initial?.screenVersion?.fileId ?? null);
const versionId = computed(() => props.initial?.screenVersion?.id ?? null);
const file = useImageFile(fileId);
const annotationQuery = useQuery({
  queryKey: computed(() => mediaKeys.annotations(versionId.value)),
  queryFn: ({ queryKey, signal }) => api.annotations(queryKey[2]!, signal),
  enabled: computed(() => !!runtime.session.identity && versionId.value !== null),
});
const box = ref<ScNormalizedBox | null>(null);
const basis = ref<ScNormalizedBox | null>(null);
const revision = ref(1);
const selected = ref<string | null>(null);
const deleteOpen = ref(false);
const labels = computed<ScImageLabels>(() =>
  locale.value === "en" ? mediaMessages.en.imageLabels : mediaMessages.ko.imageLabels,
);
const mismatch = computed(
  () =>
    !!file.image.value &&
    (file.image.value.naturalWidth !== props.initial?.screenVersion?.width ||
      file.image.value.naturalHeight !== props.initial?.screenVersion?.height),
);
const annotations = computed(() =>
  (annotationQuery.data.value ?? [])
    .filter((annotation) => annotation.requirementId !== props.initial?.id)
    .map((annotation) => ({
      id: String(annotation.id),
      label: `${annotation.number}: ${annotation.title}`,
      box: { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
    })),
);
watch(
  () => props.resetKey,
  () => {
    const annotation = props.initial?.annotation;
    const candidate = annotation
      ? { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height }
      : null;
    box.value = isNormalizedBox(candidate) ? { ...candidate } : null;
    basis.value = box.value;
    revision.value = props.initial?.revision ?? 1;
    selected.value = null;
    deleteOpen.value = false;
  },
  { immediate: true },
);
watch(
  () => [box.value, basis.value] as const,
  () => emit("dirty-change", JSON.stringify(box.value) !== JSON.stringify(basis.value)),
  { immediate: true },
);
/**
 * 편집 가능·중복 저장 없음·좌표 존재·이미지 크기 일치를 확인한 뒤 부모에게 알린다. 이 함수가 DB를 직접 저장하는 것은 아니다.
 */
function saveBox() {
  if (!props.readonly && !props.busy && box.value && !mismatch.value)
    emit("save", { box: box.value, revision: revision.value });
}
/**
 * 확인 대화상자를 닫고 현재 편집 기준 revision으로 삭제를 요청한다. 실제 성공 후 초기값 갱신은 부모가 처리한다.
 */
function deleteBox() {
  if (!props.readonly && !props.busy && props.initial?.annotation) {
    deleteOpen.value = false;
    emit("delete", { revision: revision.value });
  }
}
</script>
