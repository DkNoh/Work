<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('app.patterns')" />
    <pattern-form />
    <table-patterns />
    <extension-patterns />
    <date-patterns />
    <board-patterns />
    <image-patterns />
  </section>
</template>
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ScPageHeader } from "@sc/ui";
import PatternForm from "./PatternForm.vue";
import TablePatterns from "./TablePatterns.vue";
import ExtensionPatterns from "./ExtensionPatterns.vue";
import DatePatterns from "./DatePatterns.vue";
import BoardPatterns from "./BoardPatterns.vue";
import ImagePatterns from "./ImagePatterns.vue";
const { t } = useI18n({ useScope: "global" });
</script>
