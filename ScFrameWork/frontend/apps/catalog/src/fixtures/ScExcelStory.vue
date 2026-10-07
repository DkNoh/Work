<template>
  <section class="sc-stack" aria-label="Excel 중립 예제">
    <p>아래 합성 행만 변환합니다. 실제 업무 저장과 파일 다운로드는 소비 앱에서 처리합니다.</p>
    <div class="sc-inline">
      <sc-action-button :busy="busy" @click="roundTrip">XLSX 생성과 재읽기</sc-action-button>
      <sc-action-button :disabled="busy" @click="readInvalidFile">오류 파일 검사</sc-action-button>
    </div>
    <p role="status" aria-label="Excel 변환 결과">{{ message }}</p>
    <table v-if="rows.length">
      <caption>재읽은 자료</caption>
      <thead>
        <tr>
          <th scope="col">제목</th>
          <th scope="col">수량</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index">
          <th scope="row">{{ row.title }}</th>
          <td>{{ row.amount }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ScActionButton } from "@sc/ui";
import { readWorkbook, writeWorkbook, type ScExcelCell, type ScWorkbookColumn } from "@sc/excel";
const columns = [
  { key: "title", label: "제목", type: "string" },
  { key: "amount", label: "수량", type: "number" },
] as const satisfies readonly ScWorkbookColumn[];
const rows = ref<Record<"title" | "amount", ScExcelCell>[]>([]);
const message = ref("변환 대기");
const busy = ref(false);
async function roundTrip() {
  busy.value = true;
  try {
    const bytes = await writeWorkbook({
      columns,
      rows: [
        { title: "한국어 XLSX 자료", amount: 12 },
        { title: "둘째 자료", amount: null },
      ],
    });
    const result = await readWorkbook(bytes, { columns });
    if (result.errors.length) {
      message.value = result.errors.map((error) => error.message).join(" ");
      return;
    }
    rows.value = result.rows;
    message.value = `XLSX ${bytes.byteLength}바이트, ${result.rows.length}행 재읽기 성공`;
  } catch (error) {
    message.value = error instanceof Error ? error.message : "변환 오류";
  } finally {
    busy.value = false;
  }
}
async function readInvalidFile() {
  const result = await readWorkbook(new Uint8Array([1, 2, 3]), { columns });
  message.value = result.errors.map((error) => `${error.code}: ${error.message}`).join(" ");
  // 실패한 파일은 현재 검토 중인 행을 교체하지 않는다.
}
</script>
