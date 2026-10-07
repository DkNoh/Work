import { createI18n } from "vue-i18n";
import { commonMessages } from "./messages";

export { commonMessages } from "./messages";
export type ScLocale = "ko" | "en";
export interface ScMessageTree {
  readonly [key: string]: string | ScMessageTree;
}
export interface ScI18nOptions {
  locale?: ScLocale;
  /** common.* 재정의와 앱의 app.* 메시지를 깊이 병합하며 원본을 바꾸지 않는다. */
  messages?: Partial<Record<ScLocale, ScMessageTree>>;
  onMissing?: (locale: string, key: string) => void;
}

const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);
function mergeMessages(base: ScMessageTree, extra: ScMessageTree = {}, depth = 0): ScMessageTree {
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
      const existing = merged[key];
      merged[key] = mergeMessages(typeof existing === "object" ? existing : {}, value, depth + 1);
    } else throw new TypeError("메시지는 문자열 또는 중첩 객체여야 합니다.");
  }
  return merged;
}

/** 호출할 때마다 locale·메시지가 독립적인 Vue I18n Composition 인스턴스를 만든다. */
export function createScI18n(options: ScI18nOptions = {}) {
  return createI18n({
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
      options.onMissing?.(locale, key);
    },
  });
}
