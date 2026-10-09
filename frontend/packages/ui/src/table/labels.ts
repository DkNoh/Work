/*
 * 표/가상 목록이 사용하는 한국어 기본 문구와 부분 override 병합 함수다. 언어 선택의 원본은 앱이며 이 모듈은 locale 상태를 별도로 저장하지 않는다.
 *  ScTableLabels의 함수 필드는 행 이름·전체 건수처럼 실행 시 달라지는 값을 문장에 넣는다.
 *  Partial<ScTableLabels>는 Java의 선택 설정 객체처럼 일부 필드만 덮어쓰게 한다. undefined는 걸러 기본 문구가 사라지지 않게 한다.
 */
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
