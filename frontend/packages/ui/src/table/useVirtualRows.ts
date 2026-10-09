/*
 * 가상 표와 목록이 공유하는 화면 범위·높이 측정·키 기반 포커스 composable이다. Ref<T>는 값 변화와 DOM 참조를 Vue가 추적하는 컨테이너다.
 *  스크롤 밖 행은 보통 DOM에서 제거되지만 포커스가 있는 행은 추가 렌더하여 키보드 조작을 보존한다.
 *  업무 자료는 entries 입력이 원본이며, 이 함수는 표시 범위/현재 포커스처럼 화면 안에서만 필요한 상태를 ref로 소유한다.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { defaultRangeExtractor, useVirtualizer, type VirtualItem } from "@tanstack/vue-virtual";
import type { ScVirtualOptions } from "./contracts";

interface Entry {
  readonly key: string;
}
interface FocusToken {
  key?: string;
  position: number;
}
export interface VirtualSegment {
  key: string;
  spacer?: number;
  item?: VirtualItem;
}

/** list/table의 의미 구조는 SFC가 담당하고, 스크롤 범위와 키 기반 포커스만 공유한다. */
export function useVirtualRows(
  entries: Ref<readonly Entry[]>,
  viewport: Ref<HTMLElement | null>,
  options: ScVirtualOptions,
  scrollMargin: Ref<number> = ref(0),
) {
  const focusedKey = ref<string | null>(null);
  const focusToken = ref<FocusToken | null>(null);
  const currentKey = ref<string | null>(null);
  // 정렬이나 삭제로 위치가 달라져도 업무 key → 현재 index 매핑을 다시 계산해 같은 행을 찾는다.
  const keyIndexes = computed(
    () => new Map(entries.value.map((entry, index) => [entry.key, index])),
  );
  const focusedIndex = computed(() =>
    focusedKey.value ? keyIndexes.value.get(focusedKey.value) : undefined,
  );
  const minHeight = computed(() => positive(options.estimateRowHeight ?? 48, "estimateRowHeight"));
  const height = computed(() => positive(options.height ?? 480, "height"));
  const virtualizer = useVirtualizer(
    computed(() => {
      // rangeExtractor의 결과는 vendor가 memo한다. pin 변경은 options의 반응형 입력이어야 한다.
      const pinnedIndex = focusedIndex.value;
      const overscan = options.overscan ?? 8;
      if (!Number.isInteger(overscan) || overscan < 0 || overscan > 20)
        throw new Error("Sc virtual overscan must be an integer from 0 to 20");
      return {
        count: entries.value.length,
        getScrollElement: () => viewport.value,
        estimateSize: () => minHeight.value,
        overscan,
        useAnimationFrameWithResizeObserver: true,
        getItemKey: (index: number) => entries.value[index].key,
        scrollMargin: scrollMargin.value,
        // 기본 viewport 범위에 포커스 행을 합친다. 중복 없는 정렬 index를 vendor에 주어 공간 계산을 안정적으로 유지한다.
        rangeExtractor: (range: Parameters<typeof defaultRangeExtractor>[0]) => {
          const indexes = defaultRangeExtractor(range);
          if (pinnedIndex !== undefined && !indexes.includes(pinnedIndex))
            indexes.push(pinnedIndex);
          return indexes.sort((a, b) => a - b);
        },
      };
    }),
  );
  const virtualItems = computed(() => virtualizer.value.getVirtualItems());
  // 생략된 행의 높이는 spacer로, 보이는 행은 item으로 반환한다. SFC는 이를 table의 tr 또는 list의 li로 그려 의미 구조를 보존한다.
  const segments = computed(() => {
    const result: VirtualSegment[] = [];
    let previousEnd = 0;
    for (const item of virtualItems.value) {
      const start = item.start - scrollMargin.value;
      if (start > previousEnd) result.push({ key: `gap-${item.key}`, spacer: start - previousEnd });
      result.push({ key: `row-${item.key}`, item });
      previousEnd = item.end - scrollMargin.value;
    }
    const endGap = virtualizer.value.getTotalSize() - previousEnd;
    if (endGap > 0) result.push({ key: "tail-spacer", spacer: endGap });
    return result;
  });
  function measure(element: unknown) {
    if (element instanceof HTMLElement) virtualizer.value.measureElement(element);
  }
  function findRow(key: string) {
    return Array.from(viewport.value?.querySelectorAll<HTMLElement>("[data-row-key]") ?? []).find(
      (row) => row.dataset.rowKey === key,
    );
  }
  function scrollToKey(key: string): boolean {
    if (disposed) return false;
    const index = keyIndexes.value.get(key);
    if (index === undefined) return false;
    currentKey.value = key;
    virtualizer.value.scrollToIndex(index, { align: "auto", behavior: "auto" });
    return true;
  }
  // 먼저 스크롤하고 nextTick으로 행 DOM 생성을 기다린다. 이전 컨트롤의 data-sc-focus/위치를 이용해 가능한 한 같은 조작 위치로 복귀한다.
  async function focusRow(key: string, token?: FocusToken | null): Promise<boolean> {
    if (!scrollToKey(key)) return false;
    focusedKey.value = key;
    await nextTick();
    if (disposed) return false;
    const row = findRow(key);
    const controls = Array.from(
      row?.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]") ??
        [],
    );
    const preferred =
      token?.key !== undefined
        ? controls.find((element) => element.dataset.scFocus === token.key)
        : token
          ? controls[token.position]
          : undefined;
    const canFocus = (element: HTMLElement) =>
      !element.matches(":disabled") && element.tabIndex >= 0;
    const control = preferred && canFocus(preferred) ? preferred : controls.find(canFocus);
    control?.focus({ preventScroll: true });
    const focused = Boolean(control && document.activeElement === control);
    if (!focused) focusedKey.value = null;
    return focused;
  }
  // focusin은 자식 컨트롤에서 버블링한다. 행 key와 컨트롤 위치를 함께 기억해야 자료 갱신 뒤 버튼/체크박스 포커스를 복구할 수 있다.
  function focusIn(event: FocusEvent) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const row = target?.closest<HTMLElement>("[data-row-key]");
    focusedKey.value = row?.dataset.rowKey ?? null;
    const controls = Array.from(
      row?.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]") ??
        [],
    );
    focusToken.value =
      row && target ? { key: target.dataset.scFocus, position: controls.indexOf(target) } : null;
    if (row) currentKey.value = focusedKey.value;
  }
  function focusOut(event: FocusEvent) {
    const next = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
    const previous =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-row-key]")
        : null;
    // 이동 중 제거된 이전 행의 focusout이 새 목표 행의 pin을 해제하지 않게 한다.
    if (previous?.dataset.rowKey === focusedKey.value && !next?.closest("[data-row-key]")) {
      focusedKey.value = null;
      focusToken.value = null;
    }
  }
  function currentIndex() {
    return currentKey.value ? (keyIndexes.value.get(currentKey.value) ?? 0) : 0;
  }
  async function moveRow(destination: "first" | "previous" | "next" | "last") {
    const index =
      destination === "first"
        ? 0
        : destination === "last"
          ? entries.value.length - 1
          : currentIndex() + (destination === "next" ? 1 : -1);
    const entry = entries.value[Math.max(0, Math.min(entries.value.length - 1, index))];
    if (entry) await focusRow(entry.key);
  }
  // 비동기 nextTick 뒤 이미 unmount된 화면을 만지지 않도록 수명 플래그를 둔다.
  let disposed = false;
  // 행 key의 순서를 감시한다. 같은 배열을 제자리 수정해도 순서 변경을 감지하며 삭제된 포커스 행은 viewport로 안전하게 되돌린다.
  watch(
    () => entries.value.map((entry) => entry.key).join("\u0000"),
    async () => {
      virtualizer.value.measure();
      const key = focusedKey.value;
      if (!key) return;
      const token = focusToken.value;
      if (keyIndexes.value.has(key)) {
        await nextTick();
        if (!disposed) await focusRow(key, token);
      } else {
        focusedKey.value = null;
        await nextTick();
        if (!disposed) viewport.value?.focus({ preventScroll: true });
      }
    },
    { flush: "pre" },
  );
  onBeforeUnmount(() => {
    disposed = true;
  });
  return {
    virtualizer,
    virtualItems,
    segments,
    height,
    minHeight,
    focusedKey,
    currentKey,
    currentIndex,
    measure,
    scrollToKey,
    focusRow,
    focusIn,
    focusOut,
    moveRow,
  };
}

// 무한대/NaN/0 이하 높이는 스크롤 엔진 계산을 깨뜨리므로 공개 옵션 경계에서 명시적으로 거절한다.
function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`Sc virtual ${name} must be a positive number`);
  return value;
}
