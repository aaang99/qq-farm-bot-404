<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ page: string, data: any, loading: boolean, error: string }>()
defineEmits<{ refresh: [] }>()
const query = defineModel<string>('query', { default: '' })
const animals = computed(() => (props.data?.animals || []).filter((a: any) => !query.value || String(a.name || a.id).includes(query.value)))
function name(item: any) {
  return item.name || item.itemName || `物品 ${item.itemId ?? item.id ?? item.fruitId}`
}
function duration(value: any) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds))
    return '—'
  return seconds >= 3600 ? `${Number((seconds / 3600).toFixed(2))} 小时` : `${seconds} 秒`
}
</script>

<template>
  <section class="space-y-4">
    <p v-if="error" class="rounded-xl bg-red-100 p-4 text-red-700" role="alert">
      {{ error }}
    </p>
    <p v-if="loading && !data" class="glass-panel rounded-xl p-6">
      正在读取牧场数据…
    </p>
    <div v-else-if="data == null && !error" class="glass-panel rounded-xl p-6">
      暂无数据
    </div>
    <template v-if="data">
      <template v-if="page === 'friends'">
        <div class="glass-panel rounded-xl p-4">
          好友 {{ data.friends?.length ?? 0 }} 位
        </div>
        <div v-if="!data.friends?.length" class="glass-panel rounded-xl p-6">
          暂无牧场好友
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <article v-for="friend in data.friends || []" :key="friend.gid" class="glass-panel rounded-xl p-4">
            <h2 class="font-semibold">
              {{ friend.remark || friend.name }}
            </h2><p class="mt-2 text-sm opacity-70">
              牧场等级 {{ friend.bigFarmLevel ?? '—' }} · 主城等级 {{ friend.mainCityLevel ?? '—' }}
            </p>
          </article>
        </div>
      </template>
      <template v-else-if="page === 'activity'">
        <div v-if="!data.activities?.length" class="glass-panel rounded-xl p-6">
          {{ data.message || '暂无牧场活动' }}
        </div>
        <article v-for="activity in data.activities || []" :key="activity.id" class="glass-panel rounded-xl p-4">
          <h2 class="font-semibold">
            {{ activity.name }}
          </h2>
        </article>
      </template>
      <template v-else-if="page === 'shop'">
        <article v-for="shop in data.shops || []" :key="shop.shopId" class="space-y-3">
          <h2 class="font-semibold">
            {{ shop.name || shop.shopName || (Number(shop.shopId) === 5 ? '牧场商店 5' : '牧场商店 6') }}
          </h2><p v-if="!shop.goodsList?.length" class="glass-panel rounded-xl p-5">
            暂无商品
          </p><div class="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <div v-for="goods in shop.goodsList || []" :key="goods.id" class="glass-panel rounded-xl p-4">
              <strong>{{ name(goods) }}</strong><p class="mt-2 text-sm">
                数量 {{ goods.itemCount }} · 价格 {{ goods.price }}
              </p><p class="mt-1 text-sm opacity-65">
                {{ goods.unlocked ? '已解锁' : '未解锁' }} · 已购 {{ goods.boughtNum ?? '—' }} / 限额 {{ goods.limitCount ?? '—' }}
              </p>
            </div>
          </div>
        </article>
        <article v-if="data.exchangeMarket" class="space-y-3">
          <h2 class="font-semibold">
            兑换集市
          </h2><p class="text-sm opacity-70">
            {{ data.exchangeMarket.opened && data.exchangeMarket.present ? '开放中' : '当前未开放' }} · 轮次 {{ data.exchangeMarket.roundIndex ?? '—' }}
          </p><div v-if="!data.exchangeMarket.goods?.length" class="glass-panel rounded-xl p-5">
            暂无兑换商品
          </div><div class="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <div v-for="goods in data.exchangeMarket.goods || []" :key="goods.goodsId" class="glass-panel rounded-xl p-4">
              <strong>{{ name(goods) }} × {{ goods.itemCount }}</strong><p class="mt-2 text-sm">
                消耗 {{ goods.costItemName || `物品 ${goods.costItemId}` }} × {{ goods.costCount }}
              </p><p class="mt-1 text-sm opacity-65">
                已兑换 {{ goods.limitUsed ?? '—' }} / 限额 {{ goods.limitCount ?? '—' }}
              </p>
            </div>
          </div>
        </article>
      </template>
      <template v-else-if="page === 'illustrated'">
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div class="glass-panel rounded-xl p-4">
            等级 {{ data.currentLevel ?? '—' }}
          </div><div class="glass-panel rounded-xl p-4">
            进度 {{ data.totalProgress ?? '—' }}
          </div><div class="glass-panel rounded-xl p-4">
            重量积分 {{ data.weightScore?.totalScore ?? data.ranchWeightScore ?? '—' }}
          </div><div class="glass-panel rounded-xl p-4">
            {{ data.hasClaimableReward ? '有可领取奖励' : '暂无待领奖励' }}
          </div>
        </div>
        <p v-if="!data.list?.length" class="glass-panel rounded-xl p-6">
          暂无图鉴记录
        </p><div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <article v-for="entry in data.list || []" :key="`${entry.fruitId}-${entry.rarity}`" class="glass-panel rounded-xl p-4">
            <h2 class="font-semibold">
              {{ name(entry) }}
            </h2><p class="mt-2 text-sm">
              {{ entry.unlocked ? '已解锁' : '未解锁' }} · 进度 {{ entry.progress ?? '—' }}
            </p><p v-if="entry.giant?.unlocked" class="mt-1 text-sm opacity-65">
              最佳重量 {{ Number(entry.giant.bestWeightX10) / 10 }} · 收获 {{ entry.giant.harvestCount }}
            </p>
          </article>
        </div>
      </template>
      <template v-else-if="page === 'analytics'">
        <p class="glass-panel rounded-xl p-4 text-sm opacity-70">
          {{ data.assumptions }} 以下为牧场官方配置，不代表账号实际收益。
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <span class="font-semibold">动物 {{ data.summary?.animalCount ?? animals.length }} 种</span><input v-model="query" class="border rounded-lg px-3 py-2 text-sm" style="background:var(--surface-2)" aria-label="筛选动物" placeholder="搜索动物">
        </div>
        <div class="overflow-x-auto border rounded-xl">
          <table class="w-full whitespace-nowrap text-left text-sm">
            <thead style="background:var(--surface-2)">
              <tr>
                <th class="p-3">
                  动物
                </th><th class="p-3">
                  窝棚
                </th><th class="p-3">
                  幼年 / 成长
                </th><th class="p-3">
                  基础成长周期
                </th><th class="p-3">
                  理论收获经验/小时
                </th><th class="p-3">
                  生产周期
                </th><th class="p-3">
                  生产轮数
                </th><th class="p-3">
                  每轮产物
                </th><th class="p-3">
                  收获副产物
                </th><th class="p-3">
                  生产 / 收获经验
                </th>
              </tr>
            </thead><tbody>
              <tr v-for="animal in animals" :key="animal.id" class="border-t">
                <td class="p-3 font-medium">
                  {{ animal.name }}
                </td><td class="p-3">
                  {{ animal.husbandryType }}
                </td><td class="p-3">
                  {{ duration(animal.infantSec) }} / {{ duration(animal.growSec) }}
                </td><td class="p-3">
                  {{ duration(animal.cycleSeconds) }}
                </td><td class="p-3">
                  {{ animal.harvestExpPerHour == null ? '—' : Number(animal.harvestExpPerHour).toFixed(2) }}
                </td><td class="p-3">
                  {{ duration(animal.productRoundSec) }}
                </td><td class="p-3">
                  {{ animal.maxProduceCount }}
                </td><td class="p-3">
                  {{ name(animal.productItem || {}) }} × {{ animal.productItem?.count ?? '—' }}
                </td><td class="p-3">
                  {{ name(animal.byproductItem || {}) }} × {{ animal.byproductItem?.count ?? '—' }}
                </td><td class="p-3">
                  {{ animal.produceExp }} / {{ animal.harvestExp }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>
