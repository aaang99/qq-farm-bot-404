<script setup lang="ts">
import { ref } from 'vue'
import RanchPageShell from '@/components/ranch/RanchPageShell.vue'
import { useRanchResource } from '@/composables/useRanchResource'

const page = ref('activity')
const resource = useRanchResource(page)
</script>

<template>
  <RanchPageShell title="牧场活动" :loading="resource.loading.value" :busy="resource.busy.value" :error="resource.error.value" :has-data="!!resource.data.value" @refresh="resource.refresh">
    <div v-if="!resource.data.value?.activities?.length" class="ui-card rounded-lg p-8 text-center text-gray-500">
      {{ resource.data.value?.message || '暂无已登记的牧场限时活动' }}<p class="mt-2 text-xs">
        暂无已登记的牧场限时活动。
      </p>
    </div><div v-for="activity in resource.data.value?.activities || []" :key="activity.id" class="ui-card rounded-lg p-4">
      <h2 class="font-semibold">
        {{ activity.name }}
      </h2>
    </div>
  </RanchPageShell>
</template>
