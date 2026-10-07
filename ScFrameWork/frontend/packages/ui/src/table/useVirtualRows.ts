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
  let disposed = false;
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

function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`Sc virtual ${name} must be a positive number`);
  return value;
}
