/**
 * ADO 링크 폼의 실행 시점 입력 규칙. TypeScript 타입은 컴파일 후 없어지므로 외부 입력은 Zod로 별도 확인한다.
 * ticket은 허용 문자/길이를 제한한다. URL은 HTTP(S)이고 사용자명/비밀번호가 포함되지 않은 주소만 받는다.
 * refine 콜백은 기본 문자열 검사 뒤 추가 규칙을 적용한다. Java Bean Validation의 커스텀 제약과 유사한 역할이다.
 */
import { z } from "zod";
export const adoSchema = z.object({
  ticket: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,80}$/, "1~80자의 영문·숫자·밑줄·하이픈 티켓 번호가 필요합니다."),
  url: z
    .string()
    .max(2000)
    .refine((value) => {
      if (!/^https?:\/\//.test(value) || /[\s\\]/.test(value)) return false;
      try {
        const url = new URL(value);
        return !!url.hostname && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "인증 정보 없는 HTTP 또는 HTTPS URL을 입력하세요."),
});
