import { setup, type Preview } from "@storybook/vue3-vite";
import { initialize, mswLoader } from "msw-storybook-addon";
import { http, HttpResponse } from "msw";
import { createScVuetify } from "@sc/ui";
import { createScI18n } from "@sc/i18n";
import "vuetify/styles";
import "@sc/ui/styles";
import ScStoryFrame from "../src/fixtures/ScStoryFrame.vue";
import ScStoryLocale from "../src/fixtures/ScStoryLocale.vue";
import { publicContractArgTypes } from "../src/public-contract-arg-types";

initialize({ onUnhandledRequest: "bypass" }, [
  // story의 handler는 앞에 추가된다. reset 뒤에도 이 최종 API 차단은 유지한다.
  http.all("/api", () => HttpResponse.error()),
  http.all("/api/*", () => HttpResponse.error()),
]);
setup((app) => app.use(createScI18n()).use(createScVuetify()));

const preview: Preview = {
  tags: ["autodocs"],
  initialGlobals: { locale: "ko" },
  globalTypes: {
    locale: {
      description: "공통 메시지와 Vuetify 언어",
      toolbar: {
        icon: "globe",
        items: [
          { value: "ko", title: "한국어" },
          { value: "en", title: "English" },
        ],
        dynamicTitle: true,
      },
    },
  },
  argTypesEnhancers: [
    ({ title, argTypes, initialArgs }) => publicContractArgTypes(title, argTypes, initialArgs),
    ({ argTypes }) =>
      Object.fromEntries(
        Object.entries(argTypes).map(([name, definition]) => {
          const section = definition.table?.category;
          if (["events", "slots", "exposed"].includes(section ?? "")) {
            // fixture가 조립하는 slot과 이벤트는 props Controls로 편집하지 않는다.
            definition = { ...definition, control: { disable: true } };
          }
          if (section === "exposed" && name.startsWith("$")) {
            definition = { ...definition, table: { ...definition.table, disable: true } };
          }
          const inferred = definition.table?.defaultValue;
          const summary = inferred?.summary;
          if (typeof summary === "string" && /\\u[\da-f]{4}/i.test(summary)) {
            try {
              const text: unknown = JSON.parse(summary);
              if (typeof text === "string") {
                // 추출값의 표기만 읽기 쉽게 바꾼다. 계약·필수 여부·실제 기본값은 바꾸지 않는다.
                return [
                  name,
                  {
                    ...definition,
                    table: {
                      ...definition.table,
                      defaultValue: { ...inferred, summary: JSON.stringify(text) },
                    },
                  },
                ];
              }
            } catch {
              /* 문자열 리터럴이 아니면 docgen의 표현을 유지한다. */
            }
          }
          return [name, definition];
        }),
      ),
  ],
  loaders: [mswLoader],
  decorators: [
    (story, context) => ({
      components: { story, ScStoryFrame, ScStoryLocale },
      setup: () => ({ scLocale: context.globals.locale === "en" ? "en" : "ko" }),
      template:
        context.parameters.scFrame === "shell"
          ? "<ScStoryLocale :locale='scLocale'><story /></ScStoryLocale>"
          : "<ScStoryLocale :locale='scLocale'><ScStoryFrame><story /></ScStoryFrame></ScStoryLocale>",
    }),
  ],
  afterEach: async () => {
    // 프로젝트 finalizer의 역순 실행으로 axe addon보다 먼저 전환 완료 상태를 기다린다.
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const running = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === "running" &&
          Number.isFinite(animation.effect?.getComputedTiming().endTime),
      );
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  },
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    controls: { expanded: true },
    viewport: {
      options: {
        mobile390: {
          name: "모바일 390×844",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
        desktop1366: {
          name: "업무 단말 1366×768",
          styles: { width: "1366px", height: "768px" },
          type: "desktop",
        },
        desktop1920: {
          name: "넓은 단말 1920×1080",
          styles: { width: "1920px", height: "1080px" },
          type: "desktop",
        },
      },
    },
  },
};
export default preview;
