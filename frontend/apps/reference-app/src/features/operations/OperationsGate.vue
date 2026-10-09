<template>
  <p v-if="!runtime.session.identity || access.query.isPending.value" role="status">
    {{ t("checking") }}
  </p>
  <v-alert v-else-if="access.query.isError.value" type="error" role="alert">
    {{ access.query.error.value?.message }}
    <sc-action-button variant="text" @click="access.query.refetch()">
      {{ t("retry") }}
    </sc-action-button>
  </v-alert>
  <p v-else-if="!access.admin.value" role="status">{{ t("denied") }}</p>
  <p v-else-if="!allowed" role="status">{{ t("disabled") }}</p>
  <slot v-else />
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * v-if/v-else-if 순서로 상태 하나만 표시한다. slot 렌더링 제한과 별도로 부모 Query의 enabled 및 서버 권한 검사가 필요하다.
 */

/**
 * 운영 화면 내용을 보여주기 전 세션 확인/조회 실패/권한 없음/기능 비활성을 순서대로 표시하는 경계 컴포넌트다.
 * allowed prop은 각 기능의 활성 여부이며 읽기 전용이다. 모든 조건을 통과하면 부모가 넣은 기본 slot을 렌더링한다.
 * slot은 JSP include에 전달하는 본문과 유사하지만 부모의 Vue 상태/이벤트 연결을 그대로 유지한다.
 */

import { useI18n } from "vue-i18n";
import { ScActionButton } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { useOperationsAccess } from "./capabilities";
import { operationMessages } from "./messages";
defineProps<{ allowed: boolean }>();
const runtime = useReferenceRuntime();
const access = useOperationsAccess();
const { t } = useI18n({ useScope: "local", messages: operationMessages });
</script>
