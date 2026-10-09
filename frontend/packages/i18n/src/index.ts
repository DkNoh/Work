/**
 * 공통 문구와 앱 문구를 합쳐 앱별 Vue I18n 플러그인을 만든다.
 * JSP의 서버 메시지 번들과 달리 브라우저의 locale 변경에 따라 화면 번역이 갱신된다.
 * 공통 기본 문구는 공유하지만 선택된 언어 상태는 반환된 인스턴스마다 독립적이다.
 */
import { createI18n } from "vue-i18n";
import { commonMessages } from "./messages";

export { commonMessages } from "./messages";
export type ScLocale = "ko" | "en";
// 문자열 또는 같은 구조의 하위 객체를 허용하는 재귀 타입이다. readonly는 소비 측의
// 직접 쓰기를 정적으로 제한한다. 병합 함수는 입력을 수정하지 않고 새 트리를 만든다.
export interface ScMessageTree {
  readonly [key: string]: string | ScMessageTree;
}
export interface ScI18nOptions {
  locale?: ScLocale;
  /** common.* 재정의와 앱의 app.* 메시지를 깊이 병합하며 원본을 바꾸지 않는다. */
  // Record는 ko/en별 트리, Partial은 두 언어 중 일부만 재정의해도 된다는 뜻이다.
  messages?: Partial<Record<ScLocale, ScMessageTree>>;
  onMissing?: (locale: string, key: string) => void;
}

const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);
// 단순 {...base, ...extra}는 하위 actions 전체를 덮어쓴다. 재귀 병합을 사용해
// common.actions.save만 바꿔도 cancel 등의 기본값은 유지한다. 원본 두 트리는 변경하지 않는다.
function mergeMessages(base: ScMessageTree, extra: ScMessageTree = {}, depth = 0): ScMessageTree {
  // 프로토타입 관련 예약 키와 과도한 중첩을 거절해 외부 앱 설정이 객체 구조를 오염시키지 않게 한다.
  if (depth > 32) throw new TypeError("메시지 중첩은 32단계를 넘을 수 없습니다.");
  const merged: Record<string, string | ScMessageTree> = {};
  for (const [key, value] of Object.entries(base)) {
    if (forbiddenKeys.has(key)) throw new TypeError("지원하지 않는 메시지 키입니다.");
    merged[key] = typeof value === "string" ? value : mergeMessages(value, {}, depth + 1);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (forbiddenKeys.has(key)) throw new TypeError("지원하지 않는 메시지 키입니다.");
    if (typeof value === "string") merged[key] = value;
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      // 기존 문자열을 하위 트리로 바꿀 때는 빈 객체부터 병합한다. 배열은 메시지 트리로 받지 않는다.
      const existing = merged[key];
      merged[key] = mergeMessages(typeof existing === "object" ? existing : {}, value, depth + 1);
    } else throw new TypeError("메시지는 문자열 또는 중첩 객체여야 합니다.");
  }
  return merged;
}

/** 호출할 때마다 locale·메시지가 독립적인 Vue I18n Composition 인스턴스를 만든다. */
export function createScI18n(options: ScI18nOptions = {}) {
  return createI18n({
    // legacy:false는 useI18n()의 Composition API 사용을 선택한다. globalInjection은
    // 템플릿의 $t 같은 접근을 제공하지만 앱별 인스턴스를 브라우저 전역 singleton으로 만들지는 않는다.
    legacy: false,
    globalInjection: true,
    locale: options.locale ?? "ko",
    fallbackLocale: "ko",
    messages: {
      ko: mergeMessages(commonMessages.ko, options.messages?.ko),
      en: mergeMessages(commonMessages.en, options.messages?.en),
    },
    missingWarn: false,
    fallbackWarn: false,
    missing: (locale, key) => {
      // 없는 키 알림은 앱이 선택해 처리한다. ?.는 콜백이 제공된 경우에만 호출하는 문법이다.
      options.onMissing?.(locale, key);
    },
  });
}
