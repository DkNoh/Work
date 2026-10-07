import type { StorybookConfig } from "@storybook/vue3-vite";
import catalogConfig from "../.storybook/main";

// 정상 카탈로그의 addons/Vue/docgen/정적 자료/파일 노출 경계를 함께 사용한다.
// 실패 예제는 src 밖에 두고 이 구성에서만 포함한다.
const config: StorybookConfig = {
  ...catalogConfig,
  stories: ["../negative/ScA11yFailure.stories.ts"],
};

export default config;
