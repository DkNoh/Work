// 기존 기능 폴더의 import를 유지하는 re-export다. 실제 watch/Router guard 구현을 이해하려면 shared/useDraftGuard.ts를 따라간다.
// 007의 import 위치는 유지하고 여러 업무가 쓰는 라우트 보호 구현은 shared에 둔다.
export { useDraftGuard } from "../../shared/useDraftGuard";
