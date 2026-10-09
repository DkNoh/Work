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
    <!-- 새 작성 또는 상세 초기화 완료 후에만 폼을 만든다. :busy/:readonly는 조작 제어, :server-errors는 필드 오류 전달이다. -->
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
      <!-- 이미지/첨부/ADO는 별도 기능 자식이다. 부모는 이벤트 payload와 각 채널 resetKey를 통해 같은 요구사항의 revision 흐름을 조정한다. -->
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
      <!-- 권한 computed로 담당자 변경 영역을 조건부 생성한다. 폼 submit은 assignReviewer에 연결된다. -->
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
      <!-- 댓글 입력과 이력은 서버 상세의 하위 자료다. 댓글 add 성공 시 해당 입력만 reset하며 이력은 읽기 전용으로 표시한다. -->
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
    <!-- guard.open/message는 composable 안의 ref이므로 .value로 연결한다. confirm/cancel이 대기 중 명령/Router guard의 Promise를 끝낸다. -->
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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 요구사항 상세를 본문·이미지·첨부·검토·댓글 등으로 조립한다. 각 자식의 @save/@dirty-change를 부모가 받아 API와 입력 보존을 조정한다.
 */

// 요구사항 기능의 실행 중심이다. 자식은 입력/표시, 이 화면은 권한·명령·revision·Query 갱신을, 서버 Service는 실제 트랜잭션을 맡는다.
// JSP처럼 서버에서 페이지를 다시 만드는 대신 ref/computed 변화로 template이 갱신된다. ref는 HttpSession과 다른 브라우저 화면 상태다.
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
// 선택 대상은 Router params.id가 원본이다. /workspace는 ID 없는 새 작성, /requests/:id는 기존 상세다.
const selectedId = computed(() => {
  const id = Number(route.params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
});
// ID별 상세를 Query에 보관한다. enabled가 인증/ID를 검사하고 signal을 API로 전달해 불필요한 조회를 취소한다.
const detailQuery = useQuery({
  queryKey: computed(() => requirementKeys.detail(selectedId.value)),
  queryFn: ({ queryKey, signal }) => api.detail(queryKey[2]!, signal),
  enabled: computed(() => !!runtime.session.identity && selectedId.value !== null),
});
// Query에 이전 데이터가 남아 있더라도 현재 ID와 일치할 때만 화면 원본으로 노출한다.
const view = computed(() =>
  selectedId.value !== null && detailQuery.data.value?.id === selectedId.value
    ? detailQuery.data.value
    : null,
);
// 서버 원본은 Query에 남긴다. 이 두 참조는 각 폼의 편집 시작 revision/입력을 위한 기준이다.
// 각 shallowRef는 동일한 서버 DTO를 편집 시작 기준으로 잡되 독립적으로 교체한다.
// 예: 본문 저장 성공이 검토의 dirty 입력/revision을 자동 변경하면 충돌 검사가 무력화되므로 채널별 기준을 유지한다.
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
// 공통 Select는 문자열 ID를 다룬다. 담당자 입력/원래 값/기준 revision을 별도로 두어 dirty와 서버 명령 입력을 만든다.
const assignedReviewer = ref<string | null>("");
const assignedBasis = ref("");
const assignedRevision = ref(1);
const assignmentDirty = computed(() => (assignedReviewer.value ?? "") !== assignedBasis.value);
// 모든 편집 채널의 dirty를 계산해 한 번의 이동 경고로 합친다. computed는 원본 입력을 수정하지 않는다.
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
// 현재 서버 상세와 로그인 actor에서 버튼/읽기 상태를 계산한다. 실제 저장 허용 여부는 매 API 요청마다 서버에서 재확인한다.
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
// 최초 로드·선택 변경·명시적 최신 조회·입력 폐기가 확정된 전이에 쓰는 전체 초기화다. resetKey 증가는 자식 resetForm 신호다.
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
// 선택이 바뀌면 epoch와 폼/표시 상태를 초기화한다. 이후 view가 처음 도착할 때만 initializeForms로 상세를 채운다.
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
// 제거된 화면의 요청이 늦게 완료되어 현재 폼을 갱신하지 못하도록 disposed/epoch를 변경한다.
onBeforeUnmount(() => {
  disposed = true;
  selectionEpoch += 1;
});

// 요청 시작의 ID·선택 epoch·세션 generation을 캡처한다. owns()는 await 전후에도 같은 화면/사용자가 결과를 받을 자격이 있는지 검사한다.
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
// 응답 DTO를 해당 상세 캐시에 기록하고 목록 및 관련 이미지 annotation 조회를 무효화한다. 이는 HTTP 후 클라이언트 캐시 정리이며 DB 커밋이 아니다.
function recordResponse(item: RequirementDetail) {
  runtime.queryClient.setQueryData(requirementKeys.detail(item.id), item);
  void runtime.queryClient.invalidateQueries({ queryKey: requirementKeys.lists });
  if (item.screenVersionId !== null)
    void runtime.queryClient.invalidateQueries({
      queryKey: mediaKeys.annotations(item.screenVersionId),
    });
}
// 저장한 채널은 호출자가 먼저 dirty=false로 바꾼다. 다른 채널은 clean인 경우만 최신 DTO/revision으로 맞추고 dirty 기준은 보존한다.
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
// unknown 오류를 ApiError로 좁혀 필요한 채널의 fields에 연결한다. 409에서는 conflict 표시만 바꾸며 사용자의 입력을 reset하지 않는다.
function showFailure(cause: unknown, fields?: typeof bodyErrors) {
  if (cause instanceof ApiError && fields) fields.value = { ...cause.fields };
  error.value = cause instanceof Error ? cause.message : t("request.operationError");
  if (cause instanceof ApiError && cause.status === 409) conflict.value = true;
}
// 명령 공통 흐름: 중복 방지 → 대상 캡처 → 전달된 Promise 호출 → Query 기록 → 현재 대상에만 apply → 오류/완료 표시.
// call/apply는 Java 함수형 인터페이스처럼 동작을 넘기는 함수 인수다. DB 트랜잭션 경계는 각 서버 API 내부에 있다.
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
// 본문 폼의 save 이벤트를 서버 DTO로 변환한다. 메뉴 ID는 숫자로, revision은 bodySource에서 가져오며 기존 이미지/박스도 보존한다.
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
// 이미지 자식이 보낸 정규화 좌표와 그 입력 기준 revision을 저장한다. 성공 시 이미지 채널만 먼저 clean으로 만들고 나머지 clean 기준을 동기화한다.
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
// 박스 삭제도 자식이 편집 시작에 가진 revision으로 요청한다. 본문/다른 dirty 폼을 임의로 초기화하지 않는다.
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
// File은 브라우저가 선택한 파일 객체다. mediaApi가 공통 client를 통해 업로드하고 상세 DTO 응답으로 첨부 채널을 갱신한다.
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
// 첨부 입력이 dirty면 폐기 확인을 먼저 기다린다. 대기 중 선택이 바뀌었는지 target.owns()를 다시 검사한 후 삭제한다.
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
// 권한/상태 계산을 통과한 경우에만 티켓·URL·revision을 서버에 보낸다. 오류는 ADO 폼의 독립 fields로 되돌린다.
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
// 읽기 전용 내보내기는 변경 명령 busy와 별도 상태를 쓴다. 결과는 소유한 화면에서만 텍스트 영역에 표시하고 입력 기준을 바꾸지 않는다.
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
// 검토 폼 save를 받으면 reviewSource의 revision을 붙인다. 본문 채널이 먼저 저장되었더라도 dirty 검토의 이전 기준을 몰래 교체하지 않는다.
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
// 댓글 API는 본문/검토 저장과 달리 revision 입력이 없다. 성공하면 댓글 입력만 비우고 상세 캐시 응답으로 목록/이력을 갱신한다.
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
// 제출/합의/담당자 변경은 폼 상태를 새 상세로 맞출 수 있으므로 먼저 dirty 입력 폐기를 확인한다. 확인 중 선택 변경도 검사한다.
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
// 담당자 선택 값과 기준 revision을 확인창 이전에 캡처한다. includeAssignment=false라 현재 저장하려는 담당자 입력 자체는 폐기 질문에서 제외한다.
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
// 작성자 및 제출 가능한 상태를 확인한 뒤 /submit 명령을 보낸다. 성공한 상세로 전 채널 기준을 초기화한다.
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
// 합의 가능 여부는 permissions에서 계산한다. 기존 본문 기준 revision을 보내며 서버의 상태 전이/동시성 검사가 최종 판단한다.
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
// 사용자가 입력 폐기에 동의한 뒤 최신 조회가 실제 성공했을 때만 폼을 교체한다. 실패 시 이전 캐시를 최신 응답으로 오인하지 않는다.
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
// 메뉴/사용자 선택지 조회만 각각 재시도한다. void는 Promise 결과를 여기서 기다리지 않는다는 표시이며 Query가 오류 상태를 보유한다.
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
