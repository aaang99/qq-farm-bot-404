<script setup lang="ts">
import RanchSettings from '@/components/settings/RanchSettings.vue'
</script>

<template>
  <section class="space-y-5">
    <div class="flex items-center gap-2 px-1">
      <span class="i-carbon-settings-adjust text-2xl text-emerald-500" />
      <h1 class="text-xl font-bold">
        牧场设置
      </h1>
    </div>
    <RanchSettings />
  </section>
</template>
