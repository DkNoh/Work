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
onBeforeUnmount(() => runtime.dispose());
</script>
