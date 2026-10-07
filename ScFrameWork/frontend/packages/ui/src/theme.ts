import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import { en, ko } from "vuetify/locale";
import { uiTokens } from "./tokens";

let applicationSequence = 0;

export interface ScVuetifyOptions {
  locale?: "ko" | "en";
  fallback?: "ko" | "en";
}

export function createScVuetify(options: ScVuetifyOptions = {}) {
  const color = uiTokens.color;
  const vuetify = createVuetify({
    locale: {
      locale: options.locale ?? "ko",
      fallback: options.fallback ?? "ko",
      messages: { ko, en },
    },
    icons: { defaultSet: "mdi", aliases, sets: { mdi } },
    display: { thresholds: uiTokens.breakpoint, mobileBreakpoint: "sm" },
    theme: {
      defaultTheme: "sc",
      themes: {
        sc: {
          dark: false,
          colors: {
            primary: color.primary,
            "on-primary": color.onPrimary,
            secondary: color.secondary,
            "on-secondary": color.onSecondary,
            background: color.background,
            "on-background": color.text,
            surface: color.surface,
            "on-surface": color.text,
            "surface-variant": color.surfaceMuted,
            "on-surface-variant": color.text,
            success: color.success,
            "on-success": color.onSuccess,
            warning: color.warning,
            "on-warning": color.onWarning,
            error: color.error,
            "on-error": color.onError,
            info: color.info,
            "on-info": color.onInfo,
          },
          variables: {
            // 작은 floating label도 밝은 표면에서 읽을 수 있는 대비를 확보한다.
            "medium-emphasis-opacity": uiTokens.emphasis.medium,
            "disabled-opacity": uiTokens.emphasis.disabled,
            "border-color": color.border,
            "border-opacity": 1,
          },
        },
      },
    },
    defaults: {
      VBtn: { elevation: 0 },
      VTextField: { density: "comfortable", variant: "outlined", hideDetails: "auto" },
      VCard: { border: true, rounded: "var(--sc-radius-md)" },
    },
  });
  const installVuetify = vuetify.install;
  vuetify.install = (app) => {
    // 같은 CSR 문서에 여러 소비 앱/Autodocs가 있어도 자동 ID가 겹치지 않게 한다.
    if (!app.config.idPrefix) app.config.idPrefix = `sc-${++applicationSequence}`;
    installVuetify(app);
  };
  return vuetify;
}
