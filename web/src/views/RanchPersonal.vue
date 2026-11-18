<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import RanchFarmPanel from '@/components/ranch/RanchFarmPanel.vue'
import RanchWarehousePanel from '@/components/ranch/RanchWarehousePanel.vue'
import SceneTabs from '@/components/shared/SceneTabs.vue'
import { useRanchSync } from '@/composables/useRanchSync'
import { useAccountStore } from '@/stores/account'

const store = useRanchSync()
const account = useAccountStore()
const route = useRoute()
const router = useRouter()
const tabs = [{ value: 'farm', label: '我的牧场', icon: 'i-carbon-sprout' }, { value: 'warehouse', label: '我的仓库', icon: 'i-carbon-box' }, { value: 'tasks', label: '自动任务', icon: 'i-carbon-list-checked' }, { value: 'orders', label: '我的订单', icon: 'i-carbon-task' }]
const confirmation = ref<{ title: string, message: string, payload: any, accountId: string } | null>(null)
watch(() => account.currentAccountId, () => {
  confirmation.value = null
}, { flush: 'sync' })
function requestConfirmation(title: string, message: string, payload: any) {
  confirmation.value = { title, message, payload, accountId: account.currentAccountId }
}
async function confirmAction() {
  const pending = confirmation.value
  confirmation.value = null
  if (pending && pending.accountId === account.currentAccountId)
    await store.mutate('/api/ranch/action', pending.payload)
}
const section = computed({
  get: () => ['warehouse', 'tasks', 'orders'].includes(String(route.query.view)) ? String(route.query.view) : 'farm',
  set: (value) => {
    confirmation.value = null
    void router.replace({ query: { ...route.query, view: value, tab: undefined } })
  },
})
const claimableTasks = computed(() => (store.data?.tasks || []).filter((t: any) => t.canClaim))
const claimableCount = computed(() => claimableTasks.value.length)
const sectionError = computed(() => store.data?.sectionErrors?.[section.value === 'farm' ? 'overview' : section.value] || '')
function label(item: any) {
  return item.name || item.title || `#${item.id ?? item.itemId ?? item.facilityId ?? item.ranchInstId ?? '—'}`
}
</script>

<template>
  <section class="h-full flex flex-col p-4">
    <SceneTabs v-model="section" :tabs="tabs" class="mb-4" />
    <div class="flex-1 overflow-hidden overflow-y-auto space-y-4">
      <div v-if="!account.currentAccountId" class="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-gray-800">
        请选择账号后查看牧场
      </div>
      <div v-else-if="store.error === '账号未运行' || (store.data && !store.data.sceneReady) || sectionError === '账号未运行'" class="flex flex-col items-center justify-center gap-4 rounded-lg bg-white p-12 text-center text-gray-500 shadow dark:bg-gray-800">
        <div class="i-carbon-connection-signal-off text-4xl text-gray-400" />
        <div>
          <div class="text-lg text-gray-700 font-medium dark:text-gray-300">
            账号未登录
          </div><div class="mt-1 text-sm text-gray-400">
            请先运行账号或检查网络连接
          </div>
        </div>
      </div>
      <div v-else-if="store.error" class="border border-red-200 rounded-lg bg-red-50 p-8 text-center text-red-500 dark:border-red-800 dark:bg-red-900/20" role="alert">
        <div class="mb-2 text-lg font-bold">
          获取数据失败
        </div>{{ store.error }}
      </div>
      <div v-else-if="store.loading && !store.data" class="flex justify-center py-12" role="status" aria-label="正在读取牧场">
        <div class="i-svg-spinners-90-ring-with-bg text-4xl text-blue-500" />
      </div>
      <div v-else-if="!store.data" class="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-gray-800">
        暂无牧场数据
      </div>

      <template v-if="account.currentAccountId && store.data">
        <p v-if="sectionError && sectionError !== '账号未运行'" class="rounded-xl bg-red-100 p-4 text-red-700" role="alert">
          {{ sectionError }}
        </p>
        <template v-if="store.data.sceneReady && !sectionError">
          <Transition mode="out-in" enter-active-class="transition duration-200 ease-out" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
            <RanchFarmPanel v-if="section === 'farm'" @confirm="requestConfirmation" />
            <RanchWarehousePanel v-else-if="section === 'warehouse'" />
            <div v-else-if="section === 'tasks'" class="space-y-4">
              <div v-if="store.data.tasks?.length" class="ui-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
                <span class="text-sm opacity-70">
                  共 {{ store.data.tasks.length }} 个任务，<span :class="claimableCount ? 'font-medium text-emerald-600' : ''">{{ claimableCount }}</span> 个可领取
                  <span v-if="claimableTasks.some((t: any) => t.sharedReward)" class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">含翻倍奖励</span>
                </span>
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-sm font-medium"
                  :class="claimableCount && !store.busy ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'"
                  :disabled="!claimableCount || store.busy"
                  @click="requestConfirmation('一键领取任务奖励', `将领取 ${claimableCount} 个已完成任务的奖励，含翻倍奖励的任务会按服务端规则发放。`, { action: 'claimAllTasks' })"
                >
                  {{ store.busy ? '处理中…' : '一键领取' }}
                </button>
              </div>
              <p v-if="store.error" class="rounded-lg bg-red-100 p-4 text-red-700" role="alert">
                {{ store.error }}
              </p>
              <div v-if="!store.data.tasks?.length" class="ui-card rounded-xl p-6 text-center text-gray-500">
                暂无牧场任务
              </div>
              <div v-for="task in store.data.tasks || []" :key="task.id" class="ui-card rounded-xl p-4 space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <strong class="min-w-0 break-words">{{ task.desc || `任务 #${task.id}` }}</strong>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">{{ task.isClaimed ? '已领取' : !task.isUnlocked ? '未解锁' : task.canClaim ? '已完成' : '进行中' }}</span>
                    <button
                      v-if="task.canClaim && !task.isClaimed"
                      type="button"
                      class="rounded bg-emerald-500 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
                      :disabled="store.busy"
                      @click="requestConfirmation('领取任务奖励', `确认领取「${task.desc || task.id}」的奖励？`, { action: 'claimTask', taskId: String(task.id) })"
                    >
                      领取
                    </button>
                  </div>
                </div>
                <p class="text-sm opacity-70">
                  {{ ({ 4: '成长任务', 5: '每日任务', 6: '支线任务' } as Record<number, string>)[task.taskType] }} · {{ task.progress }}<template v-if="Number(task.totalProgress) > 0">
                    / {{ task.totalProgress }}
                  </template>
                </p>
                <div v-if="Number(task.totalProgress) > 0" class="h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                  <div class="h-full bg-blue-500" :style="{ width: `${Math.max(0, Math.min(100, Number(task.progress) / Number(task.totalProgress) * 100))}%` }" />
                </div>
                <div class="flex flex-wrap gap-3 text-sm">
                  <span v-for="(reward, index) in [...(task.rewards || []), ...(task.activityRewards || [])]" :key="index" class="inline-flex items-center gap-1"><img v-if="reward.image" :src="reward.image" alt="" class="h-6 w-6 object-contain">{{ reward.name }} × {{ reward.count }}</span>
                </div>
              </div>
            </div>
            <div v-else-if="section === 'orders'" class="space-y-3">
              <div v-if="store.data.orderPanel" class="ui-card flex flex-wrap gap-6 rounded-lg p-4 text-sm">
                <span>可提交 {{ store.data.orderPanel.submitQuota }} 次</span><span>可刷新 {{ store.data.orderPanel.refreshQuota }} 次</span><span>订单板 Lv.{{ store.data.orderPanel.boardLevel }}</span>
              </div>
              <p v-if="store.data.ordersError" class="rounded-lg bg-red-100 p-4 text-red-700" role="alert">
                订单读取失败：{{ store.data.ordersError }}
              </p><div v-else-if="!store.data.orders?.length" class="ui-card rounded-xl p-6">
                暂无订单数据
              </div><div v-for="order in store.data.orders || []" :key="order.id" class="ui-card rounded-xl p-4">
                <strong>{{ label(order) }}</strong><p class="mt-2 text-sm opacity-70">
                  {{ order.statusLabel }}
                </p>
                <p class="mt-3 text-sm font-semibold">
                  需求
                </p><p v-for="item in order.requirements || []" :key="item.id" class="mt-1 text-sm opacity-70">
                  {{ label(item) }} × {{ item.count }} · 可用库存 {{ store.data.items.filter((i: any) => String(i.id) === String(item.id) && !i.locked && !i.detail?.ranchProduct).reduce((n: bigint, i: any) => n + BigInt(i.count || 0), 0n).toString() }}
                </p>
                <p class="mt-3 text-sm font-semibold">
                  奖励
                </p><p v-for="item in order.rewards || []" :key="item.id" class="mt-1 text-sm opacity-70">
                  {{ label(item) }} × {{ item.count }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button v-if="store.data.capabilities?.submitOrder && order.canSubmit" class="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40" :disabled="store.busy || store.loading" @click="requestConfirmation('提交订单', `确认提交${label(order)}？将消耗上方列出的需求物品。`, { action: 'submitOrder', slotIndex: order.slotIndex, instanceId: order.id })">
                    提交订单
                  </button>
                  <button v-if="store.data.capabilities?.refreshOrder && order.canRefresh" class="border rounded-lg px-3 py-2 text-sm disabled:opacity-40" :disabled="store.busy || store.loading" @click="requestConfirmation('刷新订单', `确认刷新${label(order)}？当前订单将被替换，并占用可用刷新次数。`, { action: 'refreshOrder', slotIndex: order.slotIndex, instanceId: order.id })">
                    刷新订单
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </template>
      </template>
    </div>
    <ConfirmModal :show="!!confirmation" :title="confirmation?.title" :message="confirmation?.message" :loading="store.busy" @confirm="confirmAction" @cancel="confirmation = null" @close="confirmation = null" />
  </section>
</template>
