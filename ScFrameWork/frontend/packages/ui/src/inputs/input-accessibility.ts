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
