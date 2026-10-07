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
