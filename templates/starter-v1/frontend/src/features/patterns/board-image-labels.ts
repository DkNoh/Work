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
