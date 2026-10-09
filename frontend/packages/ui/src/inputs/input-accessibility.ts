/*
 * TextArea/Checkbox/Select의 오류 배열과 HTML 접근성 속성 병합을 공유하는 순수 helper다.
 *  문자열 하나 또는 readonly 문자열 배열을 받아 빈 오류를 제거한다. HTTP 검증이나 폼 상태를 저장하지 않는다.
 *  Record<string, unknown>은 Java의 Map<String, Object>처럼 임의 속성을 나타내며 실제 사용 전에 typeof로 좁힌다.
 */
import { pickScHtmlAttrs } from "../contracts";

interface InputDescription {
  readonly id: string;
  readonly hasMessages: boolean;
  readonly reserved?: readonly string[];
}

export function inputErrors(messages: string | readonly string[]): string[] {
  return (typeof messages === "string" ? [messages] : messages).filter(
    (message) => message.length > 0,
  );
}

/** render마다 attrs를 읽는다. useAttrs만 바뀌는 경우도 설명·data 갱신에 반영한다. */
export function inputHtmlAttrs(
  attrs: Readonly<Record<string, unknown>>,
  description: InputDescription,
): Record<string, unknown> {
  // 부품이 직접 계산하는 ARIA와 소비자가 넘길 수 있는 일반 속성을 분리해 잘못된 의미 덮어쓰기를 막는다.
  const forwarded = pickScHtmlAttrs(attrs, {
    omit: [
      "role",
      "aria-describedby",
      "aria-labelledby",
      "aria-invalid",
      "aria-required",
      "aria-disabled",
      "aria-readonly",
      ...(description.reserved ?? []),
    ],
  });
  // 부모가 추가한 도움말 ID는 보존하고 현재 메시지가 있을 때 내부 메시지 ID를 덧붙인다.
  const externalDescription = attrs["aria-describedby"];
  if (typeof externalDescription === "string" && externalDescription.trim()) {
    const ids = externalDescription.trim().split(/\s+/);
    if (description.hasMessages) ids.push(`${description.id}-messages`);
    forwarded["aria-describedby"] = [...new Set(ids)].join(" ");
  }
  const externalLabel = attrs["aria-labelledby"];
  if (typeof externalLabel === "string" && externalLabel.trim()) {
    forwarded["aria-labelledby"] = [
      ...new Set([`${description.id}-label`, ...externalLabel.trim().split(/\s+/)]),
    ].join(" ");
  }
  return forwarded;
}
