import { config, mount } from "@vue/test-utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { createScVuetify } from "../theme";
import ScDataTable from "./ScDataTable.vue";
import ScVirtualTable from "./ScVirtualTable.vue";
import { selectPageKeys, validateRowKeys } from "./model";
import type { ScTableColumn, ScTableSort, ScTablePagination, ScVirtualHandle } from "./contracts";

interface Item {
  id: string;
  title: string;
  amount: number;
}
const source: readonly Item[] = Object.freeze([
  Object.freeze({ id: "b", title: "두 번째", amount: 20 }),
  Object.freeze({ id: "a", title: "첫 번째", amount: 10 }),
  Object.freeze({ id: "c", title: "세 번째", amount: 30 }),
]);
const columns: readonly ScTableColumn<Item>[] = Object.freeze([
  { id: "title", label: "제목", value: (item: Item) => item.title },
  { id: "amount", label: "금액", value: (item: Item) => item.amount, sortable: true },
]);
const getRowKey = (row: Item) => row.id;
const previousPlugins = config.global.plugins;
beforeAll(() => {
  config.global.plugins = [...previousPlugins, createScVuetify()];
});
afterAll(() => {
  config.global.plugins = previousPlugins;
});

describe("ScDataTable 실제 자료와 공개 계약", () => {
  it("compact·숨긴 caption·최소 폭을 제공하면서 기본 화면과 표의 이름을 보존한다", async () => {
    const wrapper = mount(ScDataTable<Item>, {
      props: {
        rows: source,
        columns,
        getRowKey,
        caption: "최근 주문",
        density: "compact",
        captionVisibility: "sr-only",
        minTableWidth: 690,
      },
    });
    try {
      expect(wrapper.classes()).toContain("sc-table-presentation--compact");
      expect(wrapper.get("caption").text()).toBe("최근 주문");
      expect(wrapper.get("caption").classes()).toContain("sc-table__caption--hidden");
      expect(wrapper.attributes("style")).toContain("--sc-table-min-width: 690px");
      await wrapper.setProps({
        density: "comfortable",
        captionVisibility: "visible",
        minTableWidth: Number.NaN,
      });
      expect(wrapper.classes()).not.toContain("sc-table-presentation--compact");
      expect(wrapper.get("caption").classes()).not.toContain("sc-table__caption--hidden");
      expect(wrapper.attributes("style")).toContain("--sc-table-min-width: 0px");
    } finally {
      wrapper.unmount();
    }
  });
  it("client 정렬·페이지를 props로 제어하고 원본을 변경하지 않는다", async () => {
    const sorting = ref<ScTableSort | null>(null);
    const pagination = ref<ScTablePagination>({ pageIndex: 0, pageSize: 2, total: 3 });
    const wrapper = mount({
      components: { ScDataTable },
      setup: () => ({ source, columns, getRowKey, sorting, pagination }),
      template:
        '<sc-data-table :rows="source" :columns="columns" :get-row-key="getRowKey" caption="자료" :sorting="sorting" :pagination="pagination" @change-sort="sorting = $event" @change-pagination="pagination = $event" />',
    });
    try {
      expect(wrapper.findAll("tbody tr").map((row) => row.attributes("data-row-key"))).toEqual([
        "b",
        "a",
      ]);
      expect(wrapper.get("table").attributes("aria-rowcount")).toBeUndefined();
      expect(wrapper.get("thead tr").attributes("aria-rowindex")).toBeUndefined();
      expect(
        wrapper.findAll("tbody tr").every((row) => row.attributes("aria-rowindex") === undefined),
      ).toBe(true);
      await wrapper.get('button[aria-label="금액: 오름차순 정렬"]').trigger("click");
      expect(sorting.value).toEqual({ columnId: "amount", direction: "asc" });
      expect(wrapper.get('th[aria-sort="ascending"]').text()).toContain("금액");
      expect(wrapper.findAll("tbody tr").map((row) => row.attributes("data-row-key"))).toEqual([
        "a",
        "b",
      ]);
      await wrapper.findAll("nav button")[1].trigger("click");
      expect(pagination.value.pageIndex).toBe(1);
      expect(wrapper.findAll("tbody tr").map((row) => row.attributes("data-row-key"))).toEqual([
        "c",
      ]);
      expect(source.map((row) => row.id)).toEqual(["b", "a", "c"]);
    } finally {
      wrapper.unmount();
    }
  });

  it("server 모드는 현재 자료를 client 정렬하거나 재페이지하지 않고 요청만 전달한다", async () => {
    const wrapper = mount(ScDataTable<Item>, {
      props: {
        rows: source,
        columns,
        getRowKey,
        caption: "서버 자료",
        dataMode: "server",
        sorting: { columnId: "amount", direction: "asc" },
        pagination: { pageIndex: 2, pageSize: 3, total: 30 },
      },
    });
    try {
      expect(wrapper.findAll("tbody tr").map((row) => row.attributes("data-row-key"))).toEqual([
        "b",
        "a",
        "c",
      ]);
      expect(wrapper.get("table").attributes("aria-rowcount")).toBe("31");
      expect(wrapper.get("thead tr").attributes("aria-rowindex")).toBe("1");
      expect(wrapper.findAll("tbody tr").map((row) => row.attributes("aria-rowindex"))).toEqual([
        "8",
        "9",
        "10",
      ]);
      await wrapper.get('button[aria-label="금액: 내림차순 정렬"]').trigger("click");
      expect(wrapper.emitted("change-sort")).toEqual([[{ columnId: "amount", direction: "desc" }]]);
      await wrapper.findAll("nav button")[1].trigger("click");
      expect(wrapper.emitted("change-pagination")).toEqual([
        [{ pageIndex: 3, pageSize: 3, total: 30 }],
      ]);
      expect(wrapper.findAll("tbody tr").map((row) => row.attributes("data-row-key"))).toEqual([
        "b",
        "a",
        "c",
      ]);
      await wrapper.setProps({ pagination: { pageIndex: 9, pageSize: 3, total: 30 } });
      expect(wrapper.findAll("tbody tr").map((row) => row.attributes("aria-rowindex"))).toEqual([
        "29",
        "30",
        "31",
      ]);
    } finally {
      wrapper.unmount();
    }
  });

  it("선택 가능한 현재 페이지만 변경하고 다른 페이지 선택과 readonly 입력을 보존한다", async () => {
    const selectedKeys = Object.freeze(["outside-page", "b"]);
    const wrapper = mount(ScDataTable<Item>, {
      props: {
        rows: source,
        columns,
        getRowKey,
        caption: "선택",
        selectionMode: "multiple",
        selectedKeys,
        isRowSelectable: (row) => row.id !== "c",
      },
    });
    try {
      await wrapper.get("thead input").setValue(true);
      expect(wrapper.emitted("update:selectedKeys")).toEqual([[["outside-page", "b", "a"]]]);
      expect(wrapper.get('[data-row-key="c"] input').attributes("disabled")).toBeDefined();
      await wrapper.get('[data-row-key="c"] input').trigger("change");
      expect(wrapper.emitted("update:selectedKeys")).toHaveLength(1);
      await wrapper.setProps({ selectedKeys: ["outside-page", "b", "a"] });
      await wrapper.get("thead input").setValue(false);
      expect(wrapper.emitted("update:selectedKeys")?.[1]).toEqual([["outside-page"]]);
      expect(selectedKeys).toEqual(["outside-page", "b"]);
    } finally {
      wrapper.unmount();
    }
  });

  it("native caption/header・typed cell slot・状態とattrs境界を保つ", async () => {
    const wrapper = mount(ScDataTable<Item>, {
      props: { rows: source, columns, getRowKey, caption: "内容", error: "通信失敗" },
      attrs: {
        id: "public-table",
        class: "consumer",
        "data-owner": "app",
        role: "grid",
        density: "compact",
      },
      slots: { cell: "<span>セル {{ params.columnId }}: {{ params.value }}</span>" },
    });
    try {
      expect(wrapper.get("caption").text()).toBe("内容");
      expect(wrapper.findAll("thead th").every((th) => th.attributes("scope") === "col")).toBe(
        true,
      );
      expect(wrapper.text()).toContain("セル title: 두 번째");
      expect(wrapper.attributes()).toMatchObject({ id: "public-table", "data-owner": "app" });
      expect(wrapper.classes()).toContain("consumer");
      expect(wrapper.attributes("role")).toBeUndefined();
      expect(wrapper.attributes("density")).toBeUndefined();
      await wrapper.get("[role=alert] button").trigger("click");
      expect(wrapper.emitted("retry")).toEqual([[]]);
      await wrapper.setProps({ loading: true });
      await wrapper.get("[role=alert] button").trigger("click");
      expect(wrapper.emitted("retry")).toHaveLength(1);
      await wrapper.setProps({ rows: [], error: undefined, loading: false });
      expect(wrapper.get("[role=status]").text()).toBe("조회된 자료가 없습니다.");
    } finally {
      wrapper.unmount();
    }
  });

  it("10000행의 일반 페이지 fallback은 실제 표·선택 상태로 동작한다", async () => {
    const rows = Array.from({ length: 10000 }, (_, index) => ({
      id: String(index),
      title: `자료 ${index}`,
      amount: index,
    }));
    const wrapper = mount(ScVirtualTable<Item>, {
      attachTo: document.body,
      props: {
        rows,
        columns,
        getRowKey,
        caption: "대규모 자료",
        selectionMode: "multiple",
        selectedKeys: ["40"],
      },
    });
    try {
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "일반 페이지 표 보기")!
        .trigger("click");
      await nextTick();
      expect(wrapper.findAll("tbody [data-row-key]")).toHaveLength(20);
      expect((wrapper.get('[data-row-key="40"] input').element as HTMLInputElement).checked).toBe(
        true,
      );
      await wrapper.get('[data-row-key="41"] input').setValue(true);
      expect(wrapper.emitted("update:selectedKeys")).toEqual([[["40", "41"]]]);
      expect(wrapper.findAll("nav button")[0].attributes("disabled")).toBeUndefined();
      expect(await (wrapper.vm as unknown as ScVirtualHandle).focusRow("250")).toBe(true);
      expect(wrapper.get('[data-row-key="250"]').text()).toContain("자료 250");
      expect((wrapper.vm as unknown as ScVirtualHandle).scrollToKey("missing-key")).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("선택 ID를 추측하지 않고 빈 키·중복 키를 거절한다", () => {
    expect(() => validateRowKeys([{ id: "same" }, { id: "same" }], (row) => row.id)).toThrow(
      "unique",
    );
    expect(() => validateRowKeys([{ id: " " }], (row) => row.id)).toThrow("non-empty");
    expect(selectPageKeys(["other", "a"], ["a", "b"], false)).toEqual(["other"]);
  });
});
