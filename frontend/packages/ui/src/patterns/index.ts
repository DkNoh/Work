/*
 * @sc/ui 기본 진입점으로 합쳐지는 페이지·검색·카드·조회 상태·목록/상세 패턴 목록이다. 앱은 같은 모양을 복제하지 않고 이 공개 컴포넌트를 조립한다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScKpiCard } from "./ScKpiCard.vue";
export { default as ScStatusBadge } from "./ScStatusBadge.vue";
export { default as ScPageHeader } from "./ScPageHeader.vue";
export { default as ScSearchPanel } from "./ScSearchPanel.vue";
export { default as ScSectionCard } from "./ScSectionCard.vue";
export { default as ScErrorPanel } from "./ScErrorPanel.vue";
export { default as ScEmptyState } from "./ScEmptyState.vue";
export { default as ScLoadingState } from "./ScLoadingState.vue";
export { default as ScListDetailLayout } from "./ScListDetailLayout.vue";
export type * from "./contracts";
