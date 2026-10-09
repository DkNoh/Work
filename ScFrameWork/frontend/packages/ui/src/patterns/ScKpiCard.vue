<template>
  <section
    v-bind="pickScHtmlAttrs(attrs, { omit: ['aria-labelledby', 'role'] })"
    class="sc-kpi-card"
    :data-tone="tone"
    :data-density="density"
    :aria-labelledby="labelId"
  >
    <span v-if="iconPath" class="sc-kpi-card__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><path :d="iconPath" /></svg>
    </span>
    <div class="sc-kpi-card__content">
      <h2 :id="labelId" class="sc-kpi-card__label">{{ label }}</h2>
      <p class="sc-kpi-card__value">{{ value }}</p>
      <div v-if="trend || note" class="sc-kpi-card__context">
        <span v-if="trend" class="sc-kpi-card__trend" :data-direction="trendDirection">
          <svg
            v-if="trendDirection !== 'neutral'"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              :d="
                trendDirection === 'up'
                  ? 'M2 11 6 7l3 3 5-6M10 4h4v4'
                  : 'M2 5l4 4 3-3 5 6M10 12h4V8'
              "
            />
          </svg>
          {{ trend }}
        </span>
        <span v-if="note" class="sc-kpi-card__note">{{ note }}</span>
      </div>
    </div>
    <svg
      v-if="iconPath"
      class="sc-kpi-card__decoration"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path :d="iconPath" />
    </svg>
  </section>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 이름·값·증감·보조 설명을 하나의 지표로 표시한다. v-if로 생략한 항목의 공간을 만들지 않으며 두 아이콘은 장식이다.
 */

/*
 * 숫자 포맷과 집계는 소비 앱이 끝낸 문자열 value를 전달한다. 카드가 통화/권한/서버 조회를 추측하지 않는다.
 *  tone은 장식 팔레트이고 trendDirection은 화살표 방향이다. 업무상 증가가 좋은지는 카드가 판단하지 않는다.
 *  useId로 접근성 제목 참조를 고정하고 density만 CSS가 읽어 값의 크기를 선택한다. 별도 ref/computed가 필요 없는 표시 전용 부품이다.
 */
import { useAttrs, useId } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScKpiCardProps, ScKpiCardSlots } from "./contracts";

defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScKpiCardProps>(), {
  note: "",
  trend: "",
  trendDirection: "neutral",
  tone: "green",
  density: "comfortable",
});
defineSlots<ScKpiCardSlots>();
const attrs = useAttrs();
const labelId = `sc-kpi-${useId()}`;
</script>
<style scoped lang="scss">
.sc-kpi-card {
  --sc-kpi-tone: var(--sc-color-primary);
  --sc-kpi-icon-background: var(--sc-color-accent-green-soft);
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--sc-space-4);
  min-width: 0;
  min-height: 128px;
  padding: var(--sc-space-4);
  overflow: hidden;
  color: var(--sc-color-text);
  background: var(--sc-color-surface);
  border-radius: var(--sc-radius-md);
  box-shadow: var(--sc-shadow-card);

  &[data-tone="violet"] {
    --sc-kpi-tone: var(--sc-color-info);
    --sc-kpi-icon-background: var(--sc-color-accent-violet-soft);
  }
  &[data-tone="pink"] {
    --sc-kpi-tone: var(--sc-color-error);
    --sc-kpi-icon-background: var(--sc-color-accent-pink-soft);
  }
  &[data-tone="amber"] {
    --sc-kpi-tone: var(--sc-color-warning);
    --sc-kpi-icon-background: var(--sc-color-accent-amber-soft);
  }
}
.sc-kpi-card__icon {
  display: grid;
  flex: 0 0 36px;
  width: 36px;
  height: 40px;
  place-items: center;
  border-radius: var(--sc-space-1);
  color: var(--sc-color-text);
  background: var(--sc-kpi-icon-background);

  svg {
    width: 22px;
    height: 22px;
    fill: currentColor;
  }
}
.sc-kpi-card__content {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.sc-kpi-card__label {
  margin: 0;
  font-size: 13px;
  font-weight: var(--sc-font-weight-medium);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.sc-kpi-card__value {
  margin: var(--sc-space-1) 0;
  font-size: 24px;
  font-weight: var(--sc-font-weight-semibold);
  line-height: var(--sc-line-height-body);
  overflow-wrap: anywhere;
}
.sc-kpi-card__context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sc-space-1);
  font-size: var(--sc-font-size-small);
  line-height: var(--sc-line-height-body);
}
.sc-kpi-card__trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--sc-color-text-muted);
  &[data-direction="up"] {
    color: var(--sc-color-success);
  }
  &[data-direction="down"] {
    color: var(--sc-color-error);
  }
  svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
.sc-kpi-card__note {
  color: var(--sc-color-text-muted);
}
.sc-kpi-card__decoration {
  position: absolute;
  right: -12px;
  bottom: -16px;
  width: 92px;
  height: 92px;
  fill: none;
  stroke: var(--sc-kpi-tone);
  stroke-width: 0.7;
  opacity: 0.1;
  pointer-events: none;
}
.sc-kpi-card[data-density="compact"] {
  .sc-kpi-card__value {
    font-size: var(--sc-font-size-title);
  }
}
</style>
