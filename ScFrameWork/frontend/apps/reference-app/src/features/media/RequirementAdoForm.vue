<template>
  <sc-section-card :title="t('ado')">
    <p>{{ t("adoHint") }}</p>
    <form class="sc-stack" novalidate :aria-label="t('ado')" @submit.prevent="saveLink">
      <sc-text-field
        v-model="ticket"
        :label="t('ticket')"
        required
        :max-length="80"
        :readonly="readonly"
        :disabled="busy"
        :error-messages="form.errors.value.ticket"
      />
      <sc-text-field
        v-model="url"
        :label="t('url')"
        required
        :max-length="2000"
        :readonly="readonly"
        :disabled="busy"
        :error-messages="form.errors.value.url"
      />
      <sc-action-button v-if="!readonly" type="submit" :busy="busy">
        {{ t("link") }}
      </sc-action-button>
    </form>
  </sc-section-card>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * v-model은 폼 필드 값을 읽고 update:modelValue 이벤트로 쓰는 연결이다. readonly/busy 조건에서 저장을 막는다.
 */

/**
 * 요구사항의 외부 티켓 링크 입력부. 직접 API를 호출하지 않고 검증한 ticket/url/revision을 save 이벤트로 부모에게 전달한다.
 * defineProps는 읽기 전용 입력 계약, defineEmits의 [input: ...]은 이벤트 인자의 tuple 타입이다. Java 메서드 시그니처와 비슷한 컴파일 검사다.
 * useForm은 저장 전 초안을 관리한다. 부모 resetKey가 바뀔 때만 새 초기값/revision을 받아 재설정하여 자동 조회가 작성 중 입력을 지우지 않게 한다.
 */

import { watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScTextField, ScActionButton, ScSectionCard } from "@sc/ui";
import type { RequirementDetail } from "../requirements/api";
import { mediaMessages } from "./messages";
import { adoSchema } from "./ado-schema";
const props = defineProps<{
  initial: RequirementDetail | null;
  resetKey: number;
  busy: boolean;
  readonly: boolean;
  serverErrors?: Readonly<Record<string, string>>;
}>();
const emit = defineEmits<{
  save: [input: { ticket: string; url: string; revision: number }];
  "dirty-change": [dirty: boolean];
}>();
const { t } = useI18n({ useScope: "local", messages: mediaMessages });
const form = useForm<{ ticket: string; url: string }>({ initialValues: { ticket: "", url: "" } });
const [ticket] = form.defineField("ticket");
const [url] = form.defineField("url");
let revision = 1;
watch(
  () => props.resetKey,
  () => {
    revision = props.initial?.revision ?? 1;
    form.resetForm({
      values: { ticket: props.initial?.ado?.ticket ?? "", url: props.initial?.ado?.url ?? "" },
    });
  },
  { immediate: true },
);
watch(
  () => form.meta.value.dirty,
  (value) => emit("dirty-change", value),
  { immediate: true },
);
watch(
  () => props.serverErrors,
  (value) => {
    form.setErrors({ ticket: undefined, url: undefined });
    form.setErrors(value ?? {});
  },
);
/**
 * Zod safeParse는 실제 실행 중 입력을 검증한다. 실패는 필드 오류로 표시하고 성공한 경우에만 부모의 저장 흐름으로 넘긴다.
 */
function saveLink() {
  if (props.busy || props.readonly) return;
  const result = adoSchema.safeParse(form.values);
  if (!result.success) {
    form.setErrors(
      Object.fromEntries(
        result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    );
    return;
  }
  emit("save", { ...result.data, revision });
}
</script>
