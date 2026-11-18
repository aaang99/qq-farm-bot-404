<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import RanchPageShell from '@/components/ranch/RanchPageShell.vue'
import SceneTabs from '@/components/shared/SceneTabs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useRanchResource } from '@/composables/useRanchResource'
import { useAccountStore } from '@/stores/account'

const page = ref('illustrated')
const resource = useRanchResource(page)
const tab = ref('all')
const query = ref('')
const pending = ref<any>(null)
const account = useAccountStore()
watch(() => account.currentAccountId, () => {
  pending.value = null
})
async function claim() {
  const payload = pending.value
  pending.value = null
  if (payload)
    await resource.mutate(payload)
}
const list = computed(() => (resource.data.value?.list || []).filter((x: any) => (tab.value === 'all' || tab.value === (x.unlocked ? 'unlocked' : 'locked')) && (!query.value || String(x.fruitId).includes(query.value) || String(x.name || '').includes(query.value))))
</script>

<template>
  <RanchPageShell title="牧场图鉴" :loading="resource.loading.value" :busy="resource.busy.value" :error="resource.error.value" :has-data="!!resource.data.value" @refresh="resource.refresh">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="ui-card rounded-lg p-4">
        牧场图鉴等级 {{ resource.data.value?.currentLevel ?? '—' }}
      </div><div class="ui-card rounded-lg p-4">
        进度 {{ resource.data.value?.totalProgress ?? '—' }}
      </div><div class="ui-card rounded-lg p-4">
        重量积分 {{ resource.data.value?.weightScore?.totalScore ?? '—' }}
      </div><div class="ui-card rounded-lg p-4">
        {{ resource.data.value?.hasClaimableReward ? '有可领奖励' : '暂无待领奖励' }}
      </div>
    </div><BaseButton :disabled="!resource.data.value?.hasClaimableReward || resource.busy.value || resource.loading.value" :loading="resource.busy.value" @click="pending = { action: 'claimIllustrated' }">
      领取图鉴奖励
    </BaseButton><div class="flex flex-wrap gap-2">
      <SceneTabs v-model="tab" :tabs="[{ value: 'all', label: '全部' }, { value: 'unlocked', label: '已解锁' }, { value: 'locked', label: '未解锁' }]" /><input v-model="query" class="border rounded-lg bg-transparent px-3 py-2" placeholder="搜索动物或 ID">
    </div><div v-if="!list.length" class="ui-card rounded-lg p-8 text-center text-gray-500">
      暂无图鉴记录
    </div><div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <article v-for="entry in list" :key="`${entry.fruitId}-${entry.rarity}`" class="ui-card rounded-lg p-4">
        <img v-if="entry.image" :src="entry.image" :alt="entry.name" class="mx-auto mb-3 h-16 w-16 object-contain"><h2 class="font-semibold">
          {{ entry.name || `动物/产物 ${entry.fruitId}` }}
        </h2><p class="mt-2 text-sm">
          {{ entry.unlocked ? '已解锁' : '未解锁' }} · 进度 {{ entry.progress ?? '—' }}
        </p><p v-if="entry.giant?.unlocked" class="mt-1 text-xs text-gray-500">
          最佳重量 {{ Number(entry.giant.bestWeightX10) / 10 }} · 收获 {{ entry.giant.harvestCount }}
        </p>
      </article>
    </div><div v-if="resource.data.value?.errors && Object.keys(resource.data.value.errors).length" class="text-sm text-amber-600">
      部分图鉴分区读取失败：{{ Object.values(resource.data.value.errors).join('；') }}
    </div><div class="grid gap-3 md:grid-cols-2">
      <article class="ui-card rounded-lg p-4">
        <h2 class="font-semibold">
          图鉴等级奖励
        </h2><div v-for="level in resource.data.value?.levels?.levelList || []" :key="level.level" class="mt-3 border-t pt-3 text-sm">
          <p>Lv.{{ level.level }} · 所需进度 {{ level.pointCondition }} · {{ level.claimed ? '已领取' : level.canClaim ? '可领取' : '未达到' }}</p><p v-for="reward in level.rewards || []" :key="reward.id" class="mt-1 text-gray-500">
            {{ reward.name || `物品 ${reward.id}` }} × {{ reward.count }}
          </p>
        </div>
      </article><article class="ui-card rounded-lg p-4">
        <h2 class="font-semibold">
          重量积分奖励
        </h2><div v-for="level in resource.data.value?.weightScore?.levels || []" :key="level.id" class="mt-3 border-t pt-3 text-sm">
          <p>积分 {{ level.scoreCondition }} · {{ level.claimed ? '已领取' : level.canClaim ? '可领取' : '未达到' }}</p><p v-for="reward in level.rewards || []" :key="reward.id" class="mt-1 text-gray-500">
            {{ reward.name || `物品 ${reward.id}` }} × {{ reward.count }}
          </p><BaseButton class="mt-2" size="sm" :disabled="!level.canClaim || level.claimed || resource.busy.value || resource.loading.value" @click="pending = { action: 'claimWeight', id: level.id }">
            领取奖励
          </BaseButton>
        </div>
      </article>
    </div><ConfirmModal :show="!!pending" title="领取牧场奖励" message="确认领取当前满足条件的奖励？" :loading="resource.busy.value" @confirm="claim" @cancel="pending = null" @close="pending = null" />
  </RanchPageShell>
</template>
