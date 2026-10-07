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
