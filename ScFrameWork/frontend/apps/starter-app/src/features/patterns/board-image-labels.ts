/**
 * 보드/이미지 공통 UI에 주입하는 영어 label 계약이다. 업무 앱의 locale에 맞춰 전달하며 공통 컴포넌트가 특정 앱 번역 사전을 import하지 않는다.
 * ScBoardLabels/ScImageLabels 타입으로 키 누락을 컴파일에서 확인한다. 이동·그리기 지침과 상태 알림은 키보드/스크린리더 사용자에게도 전달된다.
 */
import type { ScBoardLabels } from "@sc/ui/board";
import type { ScImageLabels } from "@sc/ui/image";
export const englishBoardLabels: ScBoardLabels = {
  loading: "Loading",
  empty: "No items.",
  retry: "Retry",
  move: "Move",
  up: "Up",
  down: "Down",
  destination: "Destination column",
  scroll: "Board scroll area",
  instructions:
    "Start with Space or Enter on the move handle; use arrow keys. Escape cancels. Separate move controls are also available.",
  started: "Move started",
  cancelled: "Move cancelled",
  requested: "Move requested",
};
export const englishImageLabels: ScImageLabels = {
  loading: "Loading",
  noImage: "No image.",
  retry: "Retry",
  coordinates: "Annotation coordinates",
  x: "Horizontal start",
  y: "Vertical start",
  width: "Width",
  height: "Height",
  apply: "Apply coordinates",
  clear: "Clear box",
  zoom: "Zoom",
  instructions:
    "Drag on the image to draw a box. Coordinate inputs also create and edit a box. Escape cancels drawing.",
  invalid: "Coordinates must have a positive size within the image between 0 and 1.",
  changed: "Box changed",
  cancelled: "Drawing cancelled",
  annotations: "Existing annotations",
};
