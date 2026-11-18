<script setup lang="ts">
import type { CollectionItem } from '@/stores/collections'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useAccountStore } from '@/stores/account'
import { useCollectionsStore } from '@/stores/collections'
import { useToastStore } from '@/stores/toast'

const { currentAccountId } = storeToRefs(useAccountStore())
const store = useCollectionsStore()
const { data, loading, error, pending } = storeToRefs(store)
const toast = useToastStore()

const seriesId = ref<string | number>(0)
const search = ref('')
const status = ref<'all' | 'active' | 'pending' | 'missing'>('all')
const selected = ref<CollectionItem | null>(null)
const rewardsOpen = ref(false)
const openRulesId = ref<number | null>(null)
const upgradeConfirmation = ref<CollectionItem | null>(null)

/** 稀有度色标：普通、稀有、珍品、天工。 */
const RARITY_CLASSES: Record<number, string> = {
  1: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30',
  2: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30',
  3: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-900/30',
  4: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
}
function rarityClass(rarity: number) {
  return RARITY_CLASSES[rarity] || RARITY_CLASSES[1]
}

function itemStatus(item: CollectionItem) {
  return item.activated ? 'active' : Number(item.ownCount) > 0 ? 'pending' : 'missing'
}
function itemStateText(item: CollectionItem) {
  return { active: '已激活', pending: '待激活', missing: '未获得' }[itemStatus(item)]
}
function itemMeta(item: CollectionItem) {
  if (item.activated)
    return `${item.score.toLocaleString()} 分`
  return Number(item.ownCount) > 0 ? `持有 ${item.ownCount}` : '未获得'
}

const allItems = computed(() => (data.value?.series || []).flatMap(series => series.items))
const statusFilters = computed(() => {
  const counts = { active: 0, pending: 0, missing: 0 }
  for (const item of allItems.value)
    counts[itemStatus(item)]++
  return [
    { value: 'all' as const, label: `全部 ${allItems.value.length}` },
    { value: 'active' as const, label: `已激活 ${counts.active}` },
    { value: 'pending' as const, label: `待激活 ${counts.pending}` },
    { value: 'missing' as const, label: `未获得 ${counts.missing}` },
  ]
})
const seriesOptions = computed(() => [
  { label: '全部系列', value: 0 },
  ...(data.value?.series || []).map(series => ({ label: series.name, value: series.id })),
])
const visibleSeries = computed(() => {
  const keyword = search.value.trim()
  return (data.value?.series || [])
    .filter(series => !Number(seriesId.value) || series.id === Number(seriesId.value))
    .map(series => ({
      ...series,
      items: series.items.filter(item =>
        (!keyword || `${item.name} ${series.name}`.includes(keyword))
        && (status.value === 'all' || itemStatus(item) === status.value)),
    }))
    .filter(series => series.items.length)
})
const progress = computed(() => {
  const snapshot = data.value
  if (!snapshot)
    return 0
  return snapshot.nextRewardScore ? Math.min(100, snapshot.score / snapshot.nextRewardScore * 100) : 100
})
const selectedSeries = computed(() => data.value?.series.find(series => series.items.some(item => item.id === selected.value?.id)))
const claimableMilestones = computed(() => (data.value?.milestones || []).filter(row => row.reached && !row.claimed))

function segmentedClasses(active: boolean) {
  return active
    ? 'bg-emerald-500 text-white shadow-sm'
    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
}

async function refresh() {
  if (currentAccountId.value && !pending.value)
    await store.fetch(currentAccountId.value)
}

async function operate(action: 'upgrade' | 'claim' | 'display', input: Record<string, unknown>, message: string) {
  const result = await store.operate(String(currentAccountId.value || ''), action, input)
  if (result.stale)
    return
  if (result.ok)
    toast.success(result.data?.skipped ? '当前状态已更新，无需重复操作' : message)
  else
    toast.error(result.error || '藏品操作失败')
}

async function upgrade() {
  const item = upgradeConfirmation.value
  if (!item)
    return
  await operate('upgrade', {
    collectionId: item.id,
    expectedStarLevel: item.starLevel,
    expectedCosts: item.nextStarCosts.map(cost => ({ itemId: cost.itemId, count: cost.count })),
  }, item.activated ? `${item.name}已升至 ${item.starLevel + 1} 星` : `${item.name}已激活`)
  if (upgradeConfirmation.value === item)
    upgradeConfirmation.value = null
}

async function toggleDisplay() {
  const item = selected.value
  if (!item)
    return
  await operate('display', {
    collectionId: item.id,
    displayed: !item.displayed,
    expectedDisplayItemId: data.value?.display?.itemId || '0',
  }, item.displayed ? '已取消展示' : `正在展示${item.name}`)
}

async function claimRewards() {
  const count = claimableMilestones.value.length
  if (!count)
    return
  await operate('claim', {}, `已领取 ${count} 档评分奖励`)
}

watch(data, () => {
  if (selected.value)
    selected.value = allItems.value.find(item => item.id === selected.value?.id) || null
})

watch(currentAccountId, () => {
  store.reset()
  selected.value = null
  rewardsOpen.value = false
  upgradeConfirmation.value = null
  if (currentAccountId.value)
    void refresh()
}, { immediate: true, flush: 'sync' })

onBeforeUnmount(() => store.reset())
</script>

<template>
  <div class="space-y-4">
    <div v-if="!currentAccountId" class="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
      请先选择账号，再查看藏品。
    </div>

    <div v-else-if="error" class="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
      <p class="text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </p>
      <BaseButton class="mx-auto mt-3 w-28" variant="primary" :loading="loading" @click="refresh">
        重新读取
      </BaseButton>
    </div>

    <div v-else-if="loading && !data" class="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
      正在读取藏品数据...
    </div>

    <template v-else-if="data">
      <!-- 概览 -->
      <div class="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <div class="i-carbon-trophy text-xl text-amber-500" />
              <h2 class="text-lg font-bold">
                蓝晶藏品
              </h2>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ data.activatedCount }}/{{ data.totalCount }} 已激活 · 总评分 {{ data.score.toLocaleString() }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <BaseButton variant="primary" @click="rewardsOpen = true">
              评分奖励
            </BaseButton>
            <BaseButton variant="primary" :loading="loading" :disabled="!!pending" @click="refresh">
              刷新
            </BaseButton>
          </div>
        </div>

        <div v-if="data.nextRewardScore !== null" class="mt-3">
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>距下一档评分奖励</span>
            <span>{{ data.score.toLocaleString() }} / {{ data.nextRewardScore.toLocaleString() }}</span>
          </div>
          <div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${progress}%` }" />
          </div>
        </div>
        <p v-else class="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
          评分奖励已全部领取
        </p>

        <div v-if="data.currentBuffs.length" class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">当前加成</span>
          <span
            v-for="buff in data.currentBuffs"
            :key="buff.id"
            class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            {{ buff.description }}
          </span>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="h-9 inline-flex overflow-hidden border border-gray-200 rounded-lg bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            v-for="item in statusFilters"
            :key="item.value"
            class="rounded-md px-3 text-sm font-medium transition"
            :class="segmentedClasses(status === item.value)"
            @click="status = item.value"
          >
            {{ item.label }}
          </button>
        </div>
        <BaseSelect v-model="seriesId" :options="seriesOptions" class="w-36" />
        <input
          v-model="search"
          type="text"
          placeholder="搜索藏品或系列"
          class="h-9 min-w-0 flex-1 border border-gray-200 rounded-lg bg-white px-3 text-sm sm:flex-none sm:w-48 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 focus:border-emerald-500 focus:outline-none"
        >
      </div>

      <!-- 系列分组 -->
      <div v-for="series in visibleSeries" :key="series.id" class="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
        <div class="mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base font-bold">
              {{ series.name }}
            </h3>
            <span class="rounded px-1.5 py-0.5 text-xs" :class="rarityClass(series.rarity)">{{ series.rarityName }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ series.activatedCount }}/{{ series.totalCount }}</span>
            <div v-if="series.mutationRules.length" class="relative">
              <button
                type="button"
                class="i-carbon-help cursor-pointer text-base text-gray-400 hover:text-emerald-500"
                :aria-label="`${series.name}变异说明`"
                @click.stop="openRulesId = openRulesId === series.id ? null : series.id"
              />
              <div
                v-if="openRulesId === series.id"
                class="absolute left-0 top-6 z-20 min-w-56 border border-gray-200 rounded-lg bg-white p-3 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <p class="mb-2 font-bold">
                  藏品变异
                </p>
                <div v-for="rule in series.mutationRules" :key="rule.name" class="flex flex-wrap gap-x-3 gap-y-1 py-0.5 text-gray-600 dark:text-gray-300">
                  <span>{{ rule.name }}</span>
                  <span>概率 <b class="text-emerald-600 dark:text-emerald-400">{{ rule.probability }}%</b></span>
                  <span>保底 <b class="text-emerald-600 dark:text-emerald-400">{{ rule.guarantee }}</b> 次</span>
                </div>
              </div>
            </div>
          </div>
          <p v-if="series.description" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ series.description }}
          </p>
        </div>

        <div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
          <button
            v-for="item in series.items"
            :key="item.id"
            type="button"
            class="relative flex flex-col items-center border rounded-xl p-2.5 text-center transition dark:border-gray-700 hover:border-emerald-400 hover:shadow-sm"
            :class="[
              itemStatus(item) === 'active' ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-900/10'
                : itemStatus(item) === 'pending' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-900/10'
                  : 'border-gray-200 dark:bg-gray-900/20',
            ]"
            :aria-label="`${item.name}，${itemStateText(item)}，查看详情`"
            @click="selected = item"
          >
            <span v-if="item.isNew" class="absolute right-1.5 top-1.5 rounded bg-red-500 px-1 text-[10px] text-white leading-4">新</span>
            <span
              class="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-900/40"
              :class="{ 'opacity-45 grayscale': itemStatus(item) === 'missing' }"
            >
              <img v-if="item.image" :src="item.image" :alt="item.name" class="h-4/5 w-4/5 object-contain" loading="lazy">
            </span>
            <span class="mt-1.5 max-w-full truncate text-xs font-medium">{{ item.name }}</span>
            <span class="mt-0.5 flex gap-0.5" :aria-label="`${item.starLevel} 星，共 ${item.maxStarLevel || 5} 星`">
              <span
                v-for="star in item.maxStarLevel || 5"
                :key="star"
                class="i-carbon-star-filled text-[10px]"
                :class="star <= item.starLevel ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'"
              />
            </span>
            <span
              class="mt-0.5 text-[11px]"
              :class="itemStatus(item) === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'"
            >
              {{ itemMeta(item) }}
            </span>
            <span
              v-if="item.displayed"
              class="mt-1 inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 text-[10px] text-blue-600 leading-4 dark:bg-blue-900/30 dark:text-blue-300"
            >
              <span class="i-carbon-view text-[10px]" />展示中
            </span>
          </button>
        </div>
      </div>

      <div v-if="!visibleSeries.length" class="border border-gray-200 rounded-lg border-dashed bg-white px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        没有符合条件的藏品，换个系列、状态或搜索词试试。
      </div>
    </template>

    <!-- 藏品详情弹窗 -->
    <Teleport to="body">
      <div v-if="selected" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="selected = null">
        <div class="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" role="dialog" :aria-label="selected.name">
          <div class="mb-4 flex items-start justify-between gap-2">
            <h3 class="text-lg font-bold">
              {{ selected.name }}
            </h3>
            <button type="button" class="i-carbon-close cursor-pointer text-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="关闭" @click="selected = null" />
          </div>

          <div class="flex items-start gap-3.5">
            <span
              class="flex h-24 w-24 flex-none items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900/40"
              :class="{ 'opacity-45 grayscale': selected && itemStatus(selected) === 'missing' }"
            >
              <img v-if="selected.image" :src="selected.image" :alt="selected.name" class="h-4/5 w-4/5 object-contain">
            </span>
            <div class="min-w-0">
              <p class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span class="rounded px-1.5 py-0.5" :class="rarityClass(selectedSeries?.rarity || 1)">{{ selectedSeries?.rarityName }}</span>
                {{ selectedSeries?.name }}
              </p>
              <p class="mt-1.5 flex gap-0.5" :aria-label="`${selected.starLevel} 星，共 ${selected.maxStarLevel || 5} 星`">
                <span
                  v-for="star in selected.maxStarLevel || 5"
                  :key="star"
                  class="i-carbon-star-filled text-sm"
                  :class="star <= selected.starLevel ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'"
                />
              </p>
              <p v-if="selected.description" class="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {{ selected.description }}
              </p>
            </div>
          </div>

          <dl class="mt-4 grid grid-cols-3 border border-gray-200 rounded-lg dark:border-gray-700">
            <div class="px-3 py-2">
              <dt class="text-[11px] text-gray-400">
                状态
              </dt>
              <dd class="mt-0.5 text-sm font-semibold">
                {{ selected ? itemStateText(selected) : '' }}
              </dd>
            </div>
            <div class="border-l border-gray-200 px-3 py-2 dark:border-gray-700">
              <dt class="text-[11px] text-gray-400">
                持有
              </dt>
              <dd class="mt-0.5 text-sm font-semibold">
                {{ selected.ownCount }}
              </dd>
            </div>
            <div class="border-l border-gray-200 px-3 py-2 dark:border-gray-700">
              <dt class="text-[11px] text-gray-400">
                评分
              </dt>
              <dd class="mt-0.5 text-sm font-semibold tabular-nums">
                {{ selected.score.toLocaleString() }}
              </dd>
            </div>
          </dl>

          <div class="mt-4">
            <strong class="text-sm">
              {{ selected.nextStarCosts.length ? (selected.activated ? '升至下一星需要' : '激活需要') : '已达最高星级' }}
            </strong>
            <div v-if="selected.nextStarCosts.length" class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="cost in selected.nextStarCosts"
                :key="cost.itemId"
                class="inline-flex items-center gap-1.5 rounded-full bg-gray-50 py-1 pl-1.5 pr-2.5 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-300"
              >
                <img v-if="cost.image" :src="cost.image" alt="" class="h-5 w-5 object-contain">
                {{ cost.name }}<b class="tabular-nums">×{{ Number(cost.count).toLocaleString() }}</b>
              </span>
            </div>
          </div>

          <ul v-if="selected.requirements.length" class="mt-4 flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
            <li v-for="requirement in selected.requirements" :key="requirement">
              {{ requirement }}
            </li>
          </ul>

          <div class="mt-4 flex justify-end gap-2">
            <BaseButton
              v-if="selected.activated"
              variant="secondary"
              :disabled="!!pending || loading"
              :loading="pending === 'display'"
              @click="toggleDisplay"
            >
              {{ selected.displayed ? '取消展示' : '展示' }}
            </BaseButton>
            <BaseButton
              v-if="selected.starLevel < selected.maxStarLevel"
              variant="primary"
              :disabled="!!pending || loading || !selected.canUpgrade"
              :loading="pending === 'upgrade'"
              :title="!selected.unlocked ? '未满足解锁条件' : !selected.canUpgrade ? '藏品副本不足' : ''"
              @click="upgradeConfirmation = selected"
            >
              {{ selected.activated ? '升星' : '激活' }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 评分奖励弹窗 -->
    <Teleport to="body">
      <div v-if="rewardsOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="rewardsOpen = false">
        <div class="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" role="dialog" aria-label="藏品评分奖励">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="text-lg font-bold">
              藏品评分奖励
            </h3>
            <div class="flex items-center gap-2">
              <BaseButton
                v-if="claimableMilestones.length"
                variant="primary"
                :loading="pending === 'claim'"
                :disabled="!!pending"
                @click="claimRewards"
              >
                领取全部（{{ claimableMilestones.length }}）
              </BaseButton>
              <button type="button" class="i-carbon-close cursor-pointer text-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="关闭" @click="rewardsOpen = false" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="milestone in data?.milestones"
              :key="milestone.level"
              class="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 border border-gray-200 rounded-lg px-3 py-2.5 text-xs dark:border-gray-700"
              :class="{
                'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/10': milestone.reached && !milestone.claimed,
                'opacity-55': milestone.claimed,
              }"
            >
              <div class="flex flex-col">
                <b class="text-sm tabular-nums">{{ milestone.score.toLocaleString() }}</b>
                <small class="text-[11px] text-gray-400">评分</small>
              </div>
              <div class="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-gray-600 dark:text-gray-300">
                <span v-for="buff in milestone.buffs" :key="buff.id" class="text-emerald-600 dark:text-emerald-400">{{ buff.description }}</span>
                <span v-for="reward in milestone.rewards" :key="reward.itemId" class="inline-flex items-center gap-1">
                  <img v-if="reward.image" :src="reward.image" alt="" class="h-5 w-5 object-contain">
                  {{ reward.name }} ×{{ reward.count }}
                </span>
              </div>
              <span
                class="text-right whitespace-nowrap"
                :class="milestone.reached && !milestone.claimed ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-gray-400'"
              >
                {{ milestone.claimed ? '已领取' : milestone.reached ? '可领取' : '未达成' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmModal
      :show="!!upgradeConfirmation"
      :title="upgradeConfirmation?.activated ? '确认升星' : '确认激活'"
      :message="upgradeConfirmation ? `${upgradeConfirmation.name} → ${upgradeConfirmation.starLevel + 1} 星\n消耗：${upgradeConfirmation.nextStarCosts.map(cost => `${cost.name} ×${Number(cost.count).toLocaleString()}`).join('、')}` : ''"
      :loading="pending === 'upgrade'"
      @confirm="upgrade"
      @cancel="upgradeConfirmation = null"
    />
  </div>
</template>
