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
  }
  &[data-tone="pink"] {
    --sc-kpi-tone: var(--sc-color-error);
  }
  &[data-tone="amber"] {
    --sc-kpi-tone: var(--sc-color-warning);
  }
}
.sc-kpi-card__icon {
  display: grid;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: var(--sc-radius-sm);
  color: var(--sc-kpi-tone);
  background: color-mix(in srgb, var(--sc-kpi-tone) 18%, var(--sc-color-surface));

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
  font-weight: var(--sc-font-weight-medium);
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.sc-kpi-card__context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sc-space-1);
  font-size: var(--sc-font-size-small);
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
  gap: var(--sc-space-3);

  .sc-kpi-card__value {
    font-size: var(--sc-font-size-title);
  }
}
</style>
