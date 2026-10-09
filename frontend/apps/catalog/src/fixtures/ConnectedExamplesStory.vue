<template>
  <section class="sc-stack" aria-label="모의 조회 예제">
    <h1>모의 예제 목록</h1>
    <p v-if="query.isPending.value" role="status">모의 자료 불러오는 중…</p>
    <p v-else-if="query.isError.value" role="alert">{{ query.error.value?.message }}</p>
    <ul v-else>
      <li v-for="item in query.data.value?.items" :key="item.id">{{ item.title }}</li>
    </ul>
    <div>
      <sc-action-button :busy="query.isFetching.value" @click="query.refetch()">
        다시 조회
      </sc-action-button>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 모의 서버 조회의 대기·실패·목록과 다시 조회 버튼을 보여 준다. query 상태는 Vue Query의 ref여서 여기서는 .value를 읽는다.
 */

/*
 * Storybook에서 단일 runtime client와 Vue Query를 함께 쓰는 소비 예제다. MSW 합성 handler가 /examples 요청을 재현하며 운영 서버를 사용하지 않는다.
 *  memory history는 실제 주소/앱 탐색에 간섭하지 않는 Story 전용 Router다. queryFn에 받은 AbortSignal을 client로 넘겨 요청 수명을 연결한다.
 */
import { onBeforeUnmount } from "vue";
import { createMemoryHistory } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { createFrameworkRuntime } from "@sc/runtime";
import { ScActionButton } from "@sc/ui";

// 각 story는 자신만의 runtime을 갖고 HTTP는 MSW 합성 handler로만 재현한다.
const runtime = createFrameworkRuntime({ history: createMemoryHistory(), routes: [] });
const query = useQuery(
  {
    queryKey: ["examples-fixture"],
    queryFn: ({ signal }) =>
      runtime.client.request<{ items: { id: number; title: string }[] }>(
        "/examples",
        "GET",
        undefined,
        { signal },
      ),
  },
  runtime.queryClient,
);
// Story가 교체될 때 Query·세션·진행 요청을 dispose한다. 다음 Story에 이전 요청이나 runtime 이벤트가 남지 않게 한다.
onBeforeUnmount(() => runtime.dispose());
</script>
