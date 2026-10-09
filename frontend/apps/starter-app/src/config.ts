/**
 * 공통 UI 패턴 예제를 라우트/메뉴에 포함할지 결정하는 공개 빌드 설정이다. 환경값 문자열 "false"만 비활성으로 해석한다.
 * VITE_ 환경값은 브라우저 배포 코드에 들어간다. 비밀번호/서버 비밀을 넣는 설정 파일이 아니다.
 */
// 공개 빌드 설정이다. 비밀 값은 VITE_ 변수에 넣지 않는다.
export const patternsEnabled = import.meta.env.VITE_SC_PATTERNS_ENABLED !== "false";
