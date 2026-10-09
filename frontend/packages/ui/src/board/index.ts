/*
 * @sc/ui/board 진입점: 공개 보드와 업무 중립 이동/열/slot 타입만 내보낸다. 내부 ScBoardItem/Column과 vendor 센서는 숨겨 구현 교체의 영향을 줄인다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScSortableBoard } from "./ScSortableBoard.vue";
export type {
  ScBoardColumn,
  ScBoardMove,
  ScBoardLabels,
  ScSortableBoardProps,
  ScSortableBoardEmits,
  ScSortableBoardSlots,
} from "./contracts";
