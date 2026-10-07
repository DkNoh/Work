import type { ScTableLabels } from "./contracts";

export const defaultTableLabels: Readonly<ScTableLabels> = {
  loading: "자료를 불러오는 중입니다.",
  empty: "조회된 자료가 없습니다.",
  retry: "다시 조회",
  selectPage: "현재 조회된 선택 가능한 행 모두 선택",
  selection: "선택",
  selectRow: (name) => `${name} 선택`,
  selectionCount: (count) => `${count}개 선택`,
  sort: (label, next) =>
    `${label}: ${next === "asc" ? "오름차순 정렬" : next === "desc" ? "내림차순 정렬" : "정렬 해제"}`,
  previousPage: "이전 페이지",
  nextPage: "다음 페이지",
  page: (current, pages, total) => `${current} / ${pages} 페이지 · ${total}건`,
  scrollRegion: (caption) => `${caption} 표 영역`,
  listScrollRegion: (label) => `${label} 스크롤 영역`,
  actions: "행 동작",
  virtualView: "가상 스크롤 보기",
  paginatedView: "일반 페이지 표 보기",
  virtualHint: "일부 행만 화면에 표시됩니다. 전체 행 탐색은 일반 페이지 표 보기를 이용하세요.",
  firstRow: "첫 행으로 이동",
  previousRow: "이전 행으로 이동",
  nextRow: "다음 행으로 이동",
  lastRow: "마지막 행으로 이동",
  rowPosition: (current, total) => `${current} / ${total}행`,
};

export function resolveTableLabels(labels?: Partial<ScTableLabels>): ScTableLabels {
  return {
    ...defaultTableLabels,
    ...Object.fromEntries(Object.entries(labels ?? {}).filter(([, value]) => value !== undefined)),
  };
}
