import { describe, expect, it } from "vitest";
import { uiTokens } from "./tokens";

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => {
      const value = parseInt(part, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("의미 색상의 텍스트 대비", () => {
  it("본문·상태·탐색의 지정 조합은 일반 크기 글자의 4.5:1 기준을 만족한다", () => {
    const color = uiTokens.color;
    const pairs = [
      [color.text, color.surface],
      [color.text, color.background],
      [color.textMuted, color.surface],
      [color.textMuted, color.background],
      [color.textMuted, color.surfaceMuted],
      [color.primary, color.surface],
      [color.primary, color.background],
      [color.primary, color.surfaceMuted],
      [color.onPrimary, color.primary],
      [color.onSecondary, color.secondary],
      [color.onSelected, color.selected],
      [color.onSuccess, color.success],
      [color.onWarning, color.warning],
      [color.onError, color.error],
      [color.onInfo, color.info],
      [color.navText, color.navBackground],
      [color.navMuted, color.navBackground],
      [color.navText, color.navHover],
      [color.navActiveText, color.navActive],
    ];
    for (const [foreground, background] of pairs) {
      expect(
        contrast(foreground, background),
        `${foreground} / ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("입력 경계는 앱의 밝은 표면에서 3:1 대비를 만족한다", () => {
    const color = uiTokens.color;
    for (const background of [color.surface, color.background, color.surfaceMuted]) {
      expect(contrast(color.controlBorder, background)).toBeGreaterThanOrEqual(3);
    }
  });

  it("포커스 윤곽은 앱의 밝은 표면에서 3:1 대비를 만족한다", () => {
    const color = uiTokens.color;
    for (const background of [color.surface, color.background, color.surfaceMuted]) {
      expect(contrast(color.focus, background)).toBeGreaterThanOrEqual(3);
    }
  });
});
