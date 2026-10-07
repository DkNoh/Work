import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";
import ScSortableBoard from "./ScSortableBoard.vue";
import type { ScBoardMove } from "./contracts";

interface Item {
  id: string;
  title: string;
}

function board(deferred = false) {
  const columns = ref([
    {
      id: "first",
      label: "첫 열",
      items: [
        { id: "alpha", title: "Alpha" },
        { id: "beta", title: "Beta" },
        { id: "gamma", title: "Gamma" },
      ],
    },
    { id: "second", label: "둘째 열", items: [] as Item[] },
  ]);
  const failure = ref("");
  const moves: ScBoardMove[] = [];
  const getKey = (item: Item) => item.id;
  const getLabel = (item: Item) => item.title;
  const accept = (move: ScBoardMove) => {
    const source = columns.value.find((column) => column.id === move.fromColumnId)!;
    const target = columns.value.find((column) => column.id === move.toColumnId)!;
    const [item] = source.items.splice(
      source.items.findIndex((item) => item.id === move.itemKey),
      1,
    );
    if (!item) throw new Error("없는 합성 항목");
    const position =
      move.beforeKey === null
        ? target.items.length
        : target.items.findIndex((item) => item.id === move.beforeKey);
    target.items.splice(position, 0, item);
  };
  const requestMove = (move: ScBoardMove) => {
    moves.push(move);
    if (!deferred) accept(move);
  };
  const wrapper = mount(
    {
      components: { ScSortableBoard },
      setup: () => ({ columns, failure, getKey, getLabel, requestMove }),
      template: `<section>
        <button type="button" data-other-focus>별도 입력</button>
        <sc-sortable-board label="합성 보드" :columns="columns" :get-item-key="getKey" :get-item-label="getLabel" :error="failure" @move="requestMove" />
      </section>`,
    },
    { attachTo: document.body },
  );
  const row = (key: string) =>
    wrapper.get(`[data-sc-board-key="${key}"]:not([aria-hidden="true"])`);
  const moveButton = (key: string) =>
    row(key).get<HTMLButtonElement>(
      `button[aria-label="${getLabel(columns.value.flatMap((column) => column.items).find((item) => item.id === key)!)}: 이동"]`,
    );
  const chooseDestination = async (key: string) => {
    await row(key).get("select").setValue("second");
    return moveButton(key).element;
  };
  return { wrapper, columns, failure, moves, accept, row, chooseDestination };
}

async function settle() {
  await nextTick();
  await nextTick();
}

describe("ScSortableBoard native 이동 후 포커스", () => {
  // 실제 SFC와 native DOM을 사용한다. Happy DOM 단위 검사로 pointer sensor 동작을 주장하지 않는다.
  it("같은 배열의 splice 이동을 감지하며 같은 열의 유효 버튼은 유지하고 교차 열은 handle로 복구한다", async () => {
    const fixture = board();
    try {
      const initialColumns = fixture.columns.value;
      const firstItems = fixture.columns.value[0]!.items;
      const down = fixture
        .row("alpha")
        .get<HTMLButtonElement>('button[aria-label="Alpha: 아래로"]').element;
      down.focus();
      down.click();
      await settle();
      expect(firstItems.map((item) => item.id)).toEqual(["beta", "alpha", "gamma"]);
      expect(document.activeElement).toBe(down);
      const move = await fixture.chooseDestination("alpha");
      move.focus();
      move.click();
      await settle();
      expect(fixture.columns.value).toBe(initialColumns);
      expect(fixture.columns.value[0]!.items).toBe(firstItems);
      expect(fixture.columns.value[1]!.items.map((item) => item.id)).toEqual(["alpha"]);
      expect(document.activeElement).toBe(fixture.row("alpha").get(".sc-board-handle").element);
    } finally {
      fixture.wrapper.unmount();
    }
  });

  it("409 안내와 이동 없는 재조회만으로 이동 성공을 추측하거나 포커스를 바꾸지 않는다", async () => {
    const fixture = board(true);
    try {
      const move = await fixture.chooseDestination("alpha");
      move.focus();
      move.click();
      fixture.failure.value = "409 이동 충돌";
      fixture.columns.value = fixture.columns.value.map((column) => ({
        ...column,
        items: [...column.items],
      }));
      await settle();
      expect(fixture.moves).toHaveLength(1);
      expect(fixture.wrapper.get('[role="alert"]').text()).toContain("409 이동 충돌");
      expect(fixture.columns.value[1]!.items).toEqual([]);
      expect(document.activeElement).toBe(move);
    } finally {
      fixture.wrapper.unmount();
    }
  });

  it("지연된 서버 승인 전에 사용자가 다른 입력으로 이동하면 focus를 빼앗지 않는다", async () => {
    const fixture = board(true);
    try {
      const move = await fixture.chooseDestination("alpha");
      move.focus();
      move.click();
      await settle();
      const other = fixture.wrapper.get<HTMLButtonElement>("[data-other-focus]").element;
      other.focus();
      fixture.accept(fixture.moves[0]!);
      await settle();
      expect(fixture.columns.value[1]!.items.map((item) => item.id)).toEqual(["alpha"]);
      expect(document.activeElement).toBe(other);
    } finally {
      fixture.wrapper.unmount();
    }
  });

  it("이전 이동의 비동기 focus 복구가 후속 native 이동의 pending 요청을 지우지 않는다", async () => {
    const fixture = board();
    try {
      const alpha = await fixture.chooseDestination("alpha");
      const beta = await fixture.chooseDestination("beta");
      alpha.focus();
      alpha.click();
      await nextTick();
      beta.focus();
      beta.click();
      await settle();
      expect(fixture.moves.map((move) => move.itemKey)).toEqual(["alpha", "beta"]);
      expect(fixture.columns.value[1]!.items.map((item) => item.id)).toEqual(["alpha", "beta"]);
      expect(document.activeElement).toBe(fixture.row("beta").get(".sc-board-handle").element);
    } finally {
      fixture.wrapper.unmount();
    }
  });
});
