<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  dailyGifts: any
}>()

const GIFT_ICONS: Record<string, string> = {
  task_claim: 'i-carbon-task-complete',
  email_rewards: 'i-carbon-email',
  mall_free_gifts: 'i-carbon-shopping-bag',
  daily_share: 'i-carbon-share',
  vip_daily_gift: 'i-carbon-star',
  month_card_gift: 'i-carbon-calendar',
}

function getGiftIcon(key: string) {
  return GIFT_ICONS[key] || 'i-carbon-gift'
}

const hasDailyData = computed(() => !!props.dailyGifts)
const gifts = computed(() => props.dailyGifts?.gifts || [])

function formatTime(timestamp: number) {
  if (!timestamp)
    return '未领取'
  const d = new Date(timestamp)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getGiftStatusText(gift: any) {
  if (!gift)
    return '未知'
  if (gift.key === 'vip_daily_gift' && gift.hasGift === false)
    return '未开通'
  if (gift.key === 'month_card_gift' && gift.hasCard === false)
    return '未开通'
  if (gift.doneToday)
    return '今日已完成'
  if (gift.enabled)
    return '等待执行'
  return '未开启'
}

function formatGiftSubText(gift: any) {
  if (!gift)
    return ''
  if (gift.key === 'vip_daily_gift' && gift.hasGift === false)
    return '未开通QQ会员或无每日礼包'
  if (gift.key === 'month_card_gift' && gift.hasCard === false)
    return '未购买月卡或已过期'
  const ts = Number(gift.lastAt || 0)
  if (!ts)
    return ''
  if (gift.doneToday)
    return `完成时间 ${formatTime(ts)}`
  if (gift.enabled)
    return `上次执行 ${formatTime(ts)}`
  return `上次检测 ${formatTime(ts)}`
}

function formatGiftProgress(gift: any) {
  if (!gift)
    return ''
  const total = Number(gift.totalCount || 0)
  const reportedCurrent = Number(gift.completedCount || 0)
  if (!total)
    return ''
  const current = gift.doneToday ? Math.max(reportedCurrent, total) : reportedCurrent
  return `进度：${current}/${total}`
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Daily Gifts Liquid Glass Card -->
    <div class="ui-card metric-card rounded-2xl p-5">
      <h3 class="mb-4 flex items-center gap-2.5 font-bold tracking-tight text-base" style="color: var(--theme-text);">
        <div class="h-8 w-8 flex items-center justify-center rounded-xl bg-pink-500/15 text-pink-500 shadow-sm border border-pink-500/20">
          <div class="i-carbon-gift text-lg" />
        </div>
        <span>每日礼包 & 任务</span>
      </h3>

      <div
        v-if="!hasDailyData"
        class="liquid-empty-box rounded-xl p-6 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        请登录账号后查看
      </div>
      <div
        v-else-if="!gifts.length"
        class="liquid-empty-box rounded-xl p-6 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        暂无每日礼包与任务数据
      </div>
      <div v-else class="grid grid-cols-2 gap-3.5 2xl:grid-cols-3 sm:grid-cols-3">
        <div
          v-for="gift in gifts"
          :key="gift.key"
          class="liquid-gift-item flex flex-col justify-between rounded-xl p-3.5 transition-all duration-200"
        >
          <div class="mb-2.5 flex items-center gap-2.5">
            <div
              class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 hover:scale-105"
              :class="gift.doneToday ? 'bg-green-500/15 border-green-500/25 text-green-500' : (gift.enabled ? 'bg-blue-500/15 border-blue-500/25 text-blue-500' : 'bg-gray-500/15 border-gray-500/25 text-gray-400')"
            >
              <div
                class="text-base"
                :class="[getGiftIcon(gift.key)]"
              />
            </div>
            <span class="text-sm font-semibold leading-tight tracking-tight truncate" style="color: var(--theme-text);">
              {{ gift.label }}
            </span>
          </div>

          <div class="flex items-end justify-between">
            <span
              class="text-xs font-bold px-2 py-0.5 rounded-lg"
              :class="gift.doneToday ? 'bg-green-500/15 text-green-600 dark:text-green-400' : (gift.enabled ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-gray-500/10 text-gray-400')"
            >
              {{ getGiftStatusText(gift) }}
            </span>

            <div class="flex flex-col items-end">
              <span v-if="formatGiftProgress(gift)" class="text-xs font-bold opacity-80" style="color: var(--theme-text);">
                {{ formatGiftProgress(gift) }}
              </span>
              <span
                v-if="formatGiftSubText(gift)"
                class="mt-0.5 text-[10px] opacity-60"
                style="color: var(--theme-text);"
              >
                {{ formatGiftSubText(gift) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.liquid-gift-item {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.8), 0 2px 10px rgba(15, 23, 42, 0.03);
}

.dark .liquid-gift-item {
  background: rgba(30, 41, 59, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.12);
}

.liquid-gift-item:hover {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.95);
  transform: translateY(-2px);
  box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.95), 0 8px 20px rgba(15, 23, 42, 0.06);
}

.dark .liquid-gift-item:hover {
  background: rgba(51, 65, 85, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}

.liquid-empty-box {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(8px);
  border: 1px dashed rgba(255, 255, 255, 0.6);
}

.dark .liquid-empty-box {
  background: rgba(15, 23, 42, 0.3);
  border: 1px dashed rgba(255, 255, 255, 0.1);
}
</style>
