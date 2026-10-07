<template>
  <section class="sc-content sc-stack requirements-workspace" :aria-label="t('request.workspace')">
    <sc-page-header
      :title="selectedId === null ? t('request.new') : t('request.detail')"
      :subtitle="t('request.workspaceHint')"
    >
      <template #actions>
        <sc-action-button
          variant="outlined"
          @click="runtime.router.push({ path: '/requests', query: route.query })"
        >
          {{ t("request.backToList") }}
        </sc-action-button>
        <sc-action-button
          v-if="selectedId !== null"
          variant="outlined"
          :busy="reloading"
          :disabled="busy"
          @click="reloadDetail"
        >
          {{ t("request.reload") }}
        </sc-action-button>
      </template>
    </sc-page-header>
    <v-alert v-if="notice" type="success" role="status">{{ notice }}</v-alert>
    <v-alert v-if="error" type="error" role="alert">{{ error }}</v-alert>
    <p v-if="conflict" role="status">{{ t("request.conflict") }}</p>
    <v-alert
      v-if="lookups.menus.isError.value || lookups.users.isError.value"
      type="error"
      role="alert"
    >
      {{ t("request.lookupError") }}
      <sc-action-button variant="text" @click="retryLookups">
        {{ t("request.retry") }}
      </sc-action-button>
    </v-alert>
    <p v-if="selectedId !== null && detailQuery.isPending.value" role="status">
      {{ t("request.loading") }}
    </p>
    <v-alert v-if="detailQuery.isError.value" type="error" role="alert">
      {{ detailQuery.error.value?.message }}
      <sc-action-button variant="text" :busy="reloading" @click="reloadDetail">
        {{ t("request.retry") }}
      </sc-action-button>
    </v-alert>
    <template v-if="selectedId === null || bodySource">
      <sc-section-card v-if="view" :title="view.title">
        <dl class="requirement-meta">
          <div>
            <dt>{{ t("request.status") }}</dt>
            <dd>{{ t(`request.statuses.${view.status}`) }}</dd>
          </div>
          <div>
            <dt>{{ t("request.author") }}</dt>
            <dd>{{ view.authorName }}</dd>
          </div>
          <div>
            <dt>{{ t("request.assignee") }}</dt>
            <dd>{{ view.assignedReviewerName ?? t("request.unassigned") }}</dd>
          </div>
          <div>
            <dt>{{ t("request.createdAt") }}</dt>
            <dd>
              <time :datetime="view.createdAt">{{ formatDate(view.createdAt) }}</time>
            </dd>
          </div>
          <div>
            <dt>{{ t("request.updatedAt") }}</dt>
            <dd>
              <time :datetime="view.updatedAt">{{ formatDate(view.updatedAt) }}</time>
            </dd>
          </div>
        </dl>
        <p>{{ t("request.timeZone") }}</p>
      </sc-section-card>
      <sc-section-card
        :title="t('request.bodyForm')"
        :description="`${t('request.basisRevision')} ${bodySource?.revision ?? 1}`"
      >
        <requirement-form
          :initial="bodySource"
          :reset-key="bodyResetKey"
          :menus="lookups.menus.data.value ?? []"
          :busy="busy || reloading"
          :readonly="selectedId !== null && !permissions.edit"
          :server-errors="bodyErrors"
          :image-mode="bodySource?.screenVersionId != null"
          @save="saveRequirement"
          @dirty-change="bodyDirty = $event"
        />
      </sc-section-card>
      <requirement-image-editor
        v-if="view?.screenVersion"
        :initial="view"
        :reset-key="imageResetKey"
        :busy="busy || reloading"
        :readonly="!permissions.edit"
        @save="saveAnnotation"
        @delete="deleteAnnotation"
        @dirty-change="imageDirty = $event"
      />
      <requirement-attachments
        v-if="view"
        :initial="view"
        :reset-key="attachmentResetKey"
        :busy="busy || reloading"
        :readonly="!permissions.edit"
        @attach="attachFile"
        @remove="removeAttachment"
        @dirty-change="attachmentDirty = $event"
      />
      <requirement-ado-form
        v-if="view && (view.ado || ['AGREED', 'ADO_LINKED'].includes(view.status))"
        :initial="view"
        :reset-key="adoResetKey"
        :busy="busy || reloading"
        :readonly="!canLinkAdo"
        :server-errors="adoErrors"
        @save="linkAdo"
        @dirty-change="adoDirty = $event"
      />
      <sc-section-card v-if="view" :title="mediaText('export')">
        <sc-action-button variant="outlined" :busy="exporting" @click="exportRequirement">
          {{ mediaText("export") }}
        </sc-action-button>
        <sc-text-area
          v-if="exportedText"
          :model-value="exportedText"
          :label="mediaText('exportResult')"
          readonly
          :rows="8"
        />
      </sc-section-card>
      <sc-section-card v-if="view && permissions.assign" :title="t('request.assign')">
        <form class="sc-stack" :aria-label="t('request.assign')" @submit.prevent="assignReviewer">
          <sc-select
            v-model="assignedReviewer"
            :label="t('request.assignee')"
            :options="reviewerOptions"
            :disabled="busy || reloading"
            :error-messages="assignmentErrors.reviewerId"
          />
          <sc-form-actions
            :busy="busy || reloading"
            :submit-label="t('request.saveAssignee')"
            :show-cancel="false"
          />
        </form>
      </sc-section-card>
      <sc-section-card
        v-if="view && (permissions.submit || permissions.agree)"
        :title="t('request.transitions')"
      >
        <div class="request-actions">
          <sc-action-button
            v-if="permissions.submit"
            :busy="busy || reloading"
            @click="submitRequirement"
          >
            {{ t("request.submit") }}
          </sc-action-button>
          <sc-action-button
            v-if="permissions.agree"
            :busy="busy || reloading"
            @click="agreeRequirement"
          >
            {{ t("request.agree") }}
          </sc-action-button>
        </div>
      </sc-section-card>
      <sc-section-card v-if="view?.review" :title="t('request.currentReview')">
        <dl class="review-summary">
          <div>
            <dt>{{ t("request.decision") }}</dt>
            <dd>{{ t(`request.decisions.${view.review.decision}`) }}</dd>
          </div>
          <div>
            <dt>{{ t("request.rationale") }}</dt>
            <dd>{{ view.review.rationale }}</dd>
          </div>
          <div>
            <dt>{{ t("request.conditions") }}</dt>
            <dd>{{ view.review.conditions || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("request.scope") }}</dt>
            <dd>{{ view.review.scope || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("request.exclusions") }}</dt>
            <dd>{{ view.review.exclusions || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("request.acceptance") }}</dt>
            <dd>{{ view.review.acceptance || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("request.estimate") }}</dt>
            <dd>{{ t(`request.estimates.${view.review.estimate}`) }}</dd>
          </div>
          <div>
            <dt>{{ t("request.updatedAt") }}</dt>
            <dd>{{ view.review.reviewerName }} · {{ formatDate(view.review.updatedAt) }}</dd>
          </div>
        </dl>
      </sc-section-card>
      <sc-section-card
        v-if="reviewSource && permissions.review"
        :title="t('request.reviewForm')"
        :description="`${t('request.basisRevision')} ${reviewSource.revision}`"
      >
        <review-form
          :initial="reviewSource"
          :reset-key="reviewResetKey"
          :busy="busy || reloading"
          :server-errors="reviewErrors"
          @save="saveReview"
          @dirty-change="reviewDirty = $event"
        />
      </sc-section-card>
      <sc-section-card v-if="view" :title="t('request.comments')">
        <requirement-comments
          :comments="view.comments"
          :reset-key="commentResetKey"
          :busy="busy || reloading"
          :server-errors="commentErrors"
          :format-date="formatDate"
          @add="addComment"
          @dirty-change="commentDirty = $event"
        />
      </sc-section-card>
      <sc-section-card v-if="view" :title="t('request.history')">
        <requirement-history :history="view.history" :format-date="formatDate" />
      </sc-section-card>
    </template>
    <sc-confirm-dialog
      v-model="guard.open.value"
      :title="t('request.confirmTitle')"
      :message="t(`request.${guard.message.value || 'leave'}`)"
      :confirm-label="t('request.continue')"
      :cancel-label="t('request.cancel')"
      @confirm="guard.finish(true)"
      @cancel="guard.finish(false)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { ApiError } from "@sc/runtime";
import { createDateFormatter } from "@sc/date";
import {
  ScActionButton,
  ScConfirmDialog,
  ScFormActions,
  ScPageHeader,
  ScSectionCard,
  ScSelect,
  ScTextArea,
} from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { createRequirementsApi, type RequirementDetail, type RequirementInput } from "./api";
import { requirementKeys, useRequirementLookups } from "./query";
import { requirementPermissions } from "./permissions";
import { useDraftGuard } from "./useDraftGuard";
import type { RequirementDraft, ReviewDraft } from "./schema";
import RequirementForm from "./RequirementForm.vue";
import ReviewForm from "./ReviewForm.vue";
import RequirementComments from "./RequirementComments.vue";
import RequirementHistory from "./RequirementHistory.vue";
import RequirementImageEditor from "../media/RequirementImageEditor.vue";
import RequirementAttachments from "../media/RequirementAttachments.vue";
import RequirementAdoForm from "../media/RequirementAdoForm.vue";
import { createMediaApi, mediaKeys } from "../media/api";
import { mediaMessages } from "../media/messages";
import type { ScNormalizedBox } from "@sc/ui/image";

const runtime = useReferenceRuntime();
const route = useRoute();
const api = createRequirementsApi(runtime);
const mediaApi = createMediaApi(runtime);
const { t, locale } = useI18n({ useScope: "global" });
const lookups = useRequirementLookups();
const selectedId = computed(() => {
  const id = Number(route.params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
});
const detailQuery = useQuery({
  queryKey: computed(() => requirementKeys.detail(selectedId.value)),
  queryFn: ({ queryKey, signal }) => api.detail(queryKey[2]!, signal),
  enabled: computed(() => !!runtime.session.identity && selectedId.value !== null),
});
const view = computed(() =>
  selectedId.value !== null && detailQuery.data.value?.id === selectedId.value
    ? detailQuery.data.value
    : null,
);
// 서버 원본은 Query에 남긴다. 이 두 참조는 각 폼의 편집 시작 revision/입력을 위한 기준이다.
const bodySource = shallowRef<RequirementDetail | null>(null);
const reviewSource = shallowRef<RequirementDetail | null>(null);
const imageSource = shallowRef<RequirementDetail | null>(null);
const attachmentSource = shallowRef<RequirementDetail | null>(null);
const adoSource = shallowRef<RequirementDetail | null>(null);
const imageResetKey = ref(0);
const attachmentResetKey = ref(0);
const adoResetKey = ref(0);
const imageDirty = ref(false);
const attachmentDirty = ref(false);
const adoDirty = ref(false);
const adoErrors = ref<Record<string, string>>({});
const exporting = ref(false);
const exportedText = ref("");
const bodyResetKey = ref(0);
const reviewResetKey = ref(0);
const commentResetKey = ref(0);
const bodyDirty = ref(false);
const reviewDirty = ref(false);
const commentDirty = ref(false);
const assignedReviewer = ref<string | null>("");
const assignedBasis = ref("");
const assignedRevision = ref(1);
const assignmentDirty = computed(() => (assignedReviewer.value ?? "") !== assignedBasis.value);
const dirty = computed(
  () =>
    !!runtime.session.identity &&
    (bodyDirty.value ||
      reviewDirty.value ||
      commentDirty.value ||
      assignmentDirty.value ||
      imageDirty.value ||
      attachmentDirty.value ||
      adoDirty.value),
);
const guard = useDraftGuard(dirty);
const busy = ref(false);
const reloading = ref(false);
const error = ref("");
const notice = ref("");
const conflict = ref(false);
const bodyErrors = ref<Record<string, string>>({});
const reviewErrors = ref<Record<string, string>>({});
const commentErrors = ref<Record<string, string>>({});
const assignmentErrors = ref<Record<string, string>>({});
let selectionEpoch = 0;
let disposed = false;
const permissions = computed(() =>
  view.value
    ? requirementPermissions(view.value, runtime.session.identity)
    : { edit: false, assign: false, submit: false, review: false, agree: false },
);
const canLinkAdo = computed(
  () =>
    !!view.value &&
    ["AGREED", "ADO_LINKED"].includes(view.value.status) &&
    !!runtime.session.identity &&
    (view.value.authorId === runtime.session.identity.id ||
      (view.value.assignedReviewerId === runtime.session.identity.id &&
        ["REVIEWER", "ADMIN"].includes(runtime.session.identity.role))),
);
function mediaText(key: "export" | "exportResult") {
  return mediaMessages[locale.value === "en" ? "en" : "ko"][key];
}
const reviewerOptions = computed(() => [
  { value: "", label: t("request.unassigned") },
  ...(lookups.users.data.value ?? [])
    .filter((user) => user.id !== view.value?.authorId && ["REVIEWER", "ADMIN"].includes(user.role))
    .map((user) => ({ value: String(user.id), label: user.displayName })),
]);
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
const formatDate = (value: string | null) => formatter.value.formatTimestamp(value);

function resetAssignment(item: RequirementDetail | null) {
  assignedBasis.value = item?.assignedReviewerId ? String(item.assignedReviewerId) : "";
  assignedReviewer.value = assignedBasis.value;
  assignedRevision.value = item?.revision ?? 1;
}
function initializeForms(item: RequirementDetail | null) {
  bodySource.value = item;
  reviewSource.value = item;
  imageSource.value = item;
  attachmentSource.value = item;
  adoSource.value = item;
  imageResetKey.value++;
  attachmentResetKey.value++;
  adoResetKey.value++;
  imageDirty.value = false;
  attachmentDirty.value = false;
  adoDirty.value = false;
  adoErrors.value = {};
  exportedText.value = "";
  bodyResetKey.value += 1;
  reviewResetKey.value += 1;
  bodyDirty.value = false;
  reviewDirty.value = false;
  resetAssignment(item);
  bodyErrors.value = {};
  reviewErrors.value = {};
  assignmentErrors.value = {};
  conflict.value = false;
}
watch(
  selectedId,
  () => {
    selectionEpoch += 1;
    initializeForms(null);
    commentResetKey.value += 1;
    commentDirty.value = false;
    commentErrors.value = {};
    busy.value = false;
    reloading.value = false;
    error.value = "";
    notice.value = "";
    exporting.value = false;
  },
  { immediate: true },
);
watch(
  view,
  (item) => {
    if (item && !bodySource.value && detailQuery.isSuccess.value) initializeForms(item);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  disposed = true;
  selectionEpoch += 1;
});

function captureTarget() {
  const epoch = selectionEpoch;
  const id = selectedId.value;
  const generation = runtime.client.getGeneration();
  return {
    id,
    owns: () =>
      !disposed &&
      selectionEpoch === epoch &&
      selectedId.value === id &&
      runtime.client.getGeneration() === generation &&
      !!runtime.session.identity,
  };
}
function recordResponse(item: RequirementDetail) {
  runtime.queryClient.setQueryData(requirementKeys.detail(item.id), item);
  void runtime.queryClient.invalidateQueries({ queryKey: requirementKeys.lists });
  if (item.screenVersionId !== null)
    void runtime.queryClient.invalidateQueries({
      queryKey: mediaKeys.annotations(item.screenVersionId),
    });
}
function synchronizeCleanBaselines(item: RequirementDetail) {
  if (!bodyDirty.value) {
    bodySource.value = item;
    bodyResetKey.value += 1;
  }
  if (!reviewDirty.value) {
    reviewSource.value = item;
    reviewResetKey.value += 1;
  }
  if (!assignmentDirty.value) resetAssignment(item);
  if (!imageDirty.value) {
    imageSource.value = item;
    imageResetKey.value++;
  }
  if (!attachmentDirty.value) {
    attachmentSource.value = item;
    attachmentResetKey.value++;
  }
  if (!adoDirty.value) {
    adoSource.value = item;
    adoResetKey.value++;
  }
  // 다른 폼의 이전 기준이 남아 있으면 한 폼의 저장 성공만으로 기존 충돌을 해소하지 않는다.
  if (
    bodySource.value?.revision === item.revision &&
    reviewSource.value?.revision === item.revision &&
    assignedRevision.value === item.revision &&
    imageSource.value?.revision === item.revision &&
    attachmentSource.value?.revision === item.revision &&
    adoSource.value?.revision === item.revision
  )
    conflict.value = false;
}
function showFailure(cause: unknown, fields?: typeof bodyErrors) {
  if (cause instanceof ApiError && fields) fields.value = { ...cause.fields };
  error.value = cause instanceof Error ? cause.message : t("request.operationError");
  if (cause instanceof ApiError && cause.status === 409) conflict.value = true;
}
async function runCommand(
  call: () => Promise<RequirementDetail>,
  apply: (item: RequirementDetail) => void,
  fields?: typeof bodyErrors,
) {
  if (busy.value || reloading.value) return;
  const target = captureTarget();
  busy.value = true;
  error.value = "";
  notice.value = "";
  if (fields) fields.value = {};
  try {
    const result = await call();
    // 이전 선택의 응답은 그 ID의 캐시까지만 반영한다. 현재 폼과 revision은 소유한 요청만 변경한다.
    if (runtime.session.identity) recordResponse(result);
    if (!target.owns()) return;
    apply(result);
    notice.value = t("request.saved");
  } catch (cause) {
    if (target.owns()) showFailure(cause, fields);
  } finally {
    if (target.owns()) busy.value = false;
  }
}
async function saveRequirement(draft: RequirementDraft) {
  const id = selectedId.value;
  const input: RequirementInput = {
    ...draft,
    menuId: Number(draft.menuId),
    revision: bodySource.value?.revision ?? 1,
    screenVersionId: bodySource.value?.screenVersionId ?? null,
    annotation: bodySource.value?.annotation
      ? {
          x: bodySource.value.annotation.x!,
          y: bodySource.value.annotation.y!,
          width: bodySource.value.annotation.width!,
          height: bodySource.value.annotation.height!,
        }
      : null,
  };
  if (id !== null && !permissions.value.edit) return;
  await runCommand(
    () => (id === null ? api.create(input) : api.save(id, input)),
    (item) => {
      bodySource.value = item;
      bodyResetKey.value += 1;
      bodyDirty.value = false;
      synchronizeCleanBaselines(item);
      if (id === null) void runtime.router.replace(`/requests/${item.id}`);
    },
    bodyErrors,
  );
}
async function saveAnnotation(input: { box: ScNormalizedBox; revision: number }) {
  const id = selectedId.value;
  if (id === null || !permissions.value.edit) return;
  await runCommand(
    () => mediaApi.annotation(id, input),
    (item) => {
      imageDirty.value = false;
      imageSource.value = item;
      imageResetKey.value++;
      synchronizeCleanBaselines(item);
    },
  );
}
async function deleteAnnotation(input: { revision: number }) {
  const id = selectedId.value;
  if (id === null || !permissions.value.edit) return;
  await runCommand(
    () => mediaApi.deleteAnnotation(id, input.revision),
    (item) => {
      imageDirty.value = false;
      imageSource.value = item;
      imageResetKey.value++;
      synchronizeCleanBaselines(item);
    },
  );
}
async function attachFile(input: { file: File; revision: number }) {
  const id = selectedId.value;
  if (id === null || !permissions.value.edit) return;
  await runCommand(
    () => mediaApi.attach(id, input.revision, input.file),
    (item) => {
      attachmentDirty.value = false;
      attachmentSource.value = item;
      attachmentResetKey.value++;
      synchronizeCleanBaselines(item);
    },
  );
}
async function removeAttachment(input: { attachmentId: number; revision: number }) {
  const id = selectedId.value;
  if (id === null || !permissions.value.edit || busy.value || reloading.value) return;
  const target = captureTarget();
  if (attachmentDirty.value && !(await guard.confirm("discardForCommand"))) return;
  if (!target.owns()) return;
  await runCommand(
    () => mediaApi.deleteAttachment(id, input.attachmentId, input.revision),
    (item) => {
      attachmentDirty.value = false;
      attachmentSource.value = item;
      attachmentResetKey.value++;
      synchronizeCleanBaselines(item);
    },
  );
}
async function linkAdo(input: { ticket: string; url: string; revision: number }) {
  const id = selectedId.value;
  if (id === null || !canLinkAdo.value) return;
  await runCommand(
    () => mediaApi.ado(id, input),
    (item) => {
      adoDirty.value = false;
      adoSource.value = item;
      adoResetKey.value++;
      synchronizeCleanBaselines(item);
    },
    adoErrors,
  );
}
async function exportRequirement() {
  if (!selectedId.value || exporting.value) return;
  const target = captureTarget();
  exporting.value = true;
  error.value = "";
  try {
    const result = await mediaApi.exportText(selectedId.value);
    if (target.owns()) exportedText.value = result.text;
  } catch (cause) {
    if (target.owns()) showFailure(cause);
  } finally {
    if (target.owns()) exporting.value = false;
  }
}
async function saveReview(draft: ReviewDraft) {
  if (!selectedId.value || !reviewSource.value || !permissions.value.review) return;
  const id = selectedId.value;
  const input = { ...draft, revision: reviewSource.value.revision };
  await runCommand(
    () => api.review(id, input),
    (item) => {
      reviewSource.value = item;
      reviewResetKey.value += 1;
      reviewDirty.value = false;
      synchronizeCleanBaselines(item);
    },
    reviewErrors,
  );
}
async function addComment(body: string) {
  const id = selectedId.value;
  if (!id) return;
  await runCommand(
    () => api.comment(id, body),
    () => {
      commentResetKey.value += 1;
      commentDirty.value = false;
    },
    commentErrors,
  );
}
async function allowTransition(includeAssignment = true) {
  const target = captureTarget();
  if (
    (bodyDirty.value ||
      reviewDirty.value ||
      imageDirty.value ||
      attachmentDirty.value ||
      adoDirty.value ||
      (includeAssignment && assignmentDirty.value)) &&
    !(await guard.confirm("discardForCommand"))
  )
    return false;
  return target.owns();
}
async function assignReviewer() {
  if (!selectedId.value || !permissions.value.assign || busy.value || reloading.value) return;
  const id = selectedId.value;
  const revision = assignedRevision.value;
  const value = assignedReviewer.value;
  if (!(await allowTransition(false))) return;
  await runCommand(
    () => api.assign(id, revision, value ? Number(value) : null),
    initializeForms,
    assignmentErrors,
  );
}
async function submitRequirement() {
  if (
    !selectedId.value ||
    !bodySource.value ||
    !permissions.value.submit ||
    busy.value ||
    reloading.value
  )
    return;
  const id = selectedId.value;
  const revision = bodySource.value.revision;
  if (!(await allowTransition())) return;
  await runCommand(() => api.submit(id, revision), initializeForms);
}
async function agreeRequirement() {
  if (
    !selectedId.value ||
    !bodySource.value ||
    !permissions.value.agree ||
    busy.value ||
    reloading.value
  )
    return;
  const id = selectedId.value;
  const revision = bodySource.value.revision;
  if (!(await allowTransition())) return;
  await runCommand(() => api.agree(id, revision), initializeForms);
}
async function reloadDetail() {
  if (!selectedId.value || busy.value || reloading.value) return;
  const target = captureTarget();
  if (dirty.value && !(await guard.confirm("reloadConfirm"))) return;
  if (!target.owns()) return;
  reloading.value = true;
  try {
    // refetch가 실패할 때 반환되는 기존 캐시를 성공한 최신 응답으로 사용하지 않는다.
    const result = await detailQuery.refetch({ throwOnError: true });
    if (!target.owns() || !result.data || result.data.id !== target.id) return;
    initializeForms(result.data);
    commentResetKey.value += 1;
    commentDirty.value = false;
    commentErrors.value = {};
    error.value = "";
  } catch (cause) {
    if (target.owns()) showFailure(cause);
  } finally {
    if (target.owns()) reloading.value = false;
  }
}
function retryLookups() {
  void lookups.menus.refetch();
  void lookups.users.refetch();
}
</script>

<style scoped lang="scss">
.requirements-workspace {
  min-width: 0;
}
.requirement-meta,
.review-summary {
  margin: 0;
  display: grid;
  gap: var(--sc-space-4);
}
.requirement-meta {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
}
dt {
  color: var(--sc-color-text-muted);
  font-size: var(--sc-font-size-small);
}
dd {
  margin: var(--sc-space-1) 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.request-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-2);
}
</style>
