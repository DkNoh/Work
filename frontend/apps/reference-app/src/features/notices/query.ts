// 공지 Query 캐시 주소 모음. Java Map의 복합 키처럼 목록 조건과 상세 ID가 서로 다른 응답을 구분한다.
// all/lists는 하위 캐시를 함께 무효화할 때, detail(id)는 저장 성공 응답을 해당 상세에 반영할 때 쓴다.
// as const는 배열을 readonly 튜플 타입으로 추론시킨다. 이 파일 자체는 HTTP 요청을 실행하지 않는다.
export const noticeKeys = {
  all: ["notices"] as const,
  lists: ["notices", "list"] as const,
  list: (q: string) => ["notices", "list", q] as const,
  detail: (id: number | null) => ["notices", "detail", id] as const,
};
