<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits<{
  (e: 'goto-collections'): void
}>()

interface Mutation {
  id: number
  name: string
  image: string
  effect: string
  description: string
  probabilities: Array<{ rarity: number | null, percent: number }>
}
interface Series {
  id: number
  name: string
  rarityName: string
  description: string
  mutationRules: Array<{ name: string, probability: number, guarantee: number }>
  items: Array<{ id: number, name: string, image: string }>
}

type CatalogTab = 'normal' | 'decoration' | 'collections'

const tab = ref<CatalogTab>('normal')
const query = ref('')
const catalog = ref<{ normal: Mutation[], decoration: Mutation[], collections: Series[] } | null>(null)
const loading = ref(false)
const error = ref('')
const openRulesId = ref<number | null>(null)

const rarityNames = ['', '普通', '稀有', '珍品', '天工']
const RARITY_CLASSES: Record<string, string> = {
  普通: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30',
  稀有: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30',
  珍品: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-900/30',
  天工: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
}
function rarityClass(name: string) {
  return RARITY_CLASSES[name] || RARITY_CLASSES['普通']
}

const tabs = computed<Array<{ value: CatalogTab, label: string }>>(() => [
  { value: 'normal', label: `常规变异${catalog.value ? ` ${catalog.value.normal.length}` : ''}` },
  { value: 'decoration', label: `装扮变异${catalog.value ? ` ${catalog.value.decoration.length}` : ''}` },
  { value: 'collections', label: `藏品变异${catalog.value ? ` ${catalog.value.collections.length}` : ''}` },
])

const keyword = computed(() => query.value.trim())
const effects = computed(() => {
  if (tab.value === 'collections')
    return []
  return (catalog.value?.[tab.value as 'normal' | 'decoration'] || [])
    .filter(effect => !keyword.value || `${effect.name}${effect.effect}${effect.description}`.includes(keyword.value))
})
const series = computed(() => (catalog.value?.collections || [])
  .map(entry => ({
    ...entry,
    items: entry.items.filter(item => !keyword.value || `${item.name} ${entry.name}`.includes(keyword.value)),
  }))
  .filter(entry => entry.items.length))

function segmentedClasses(active: boolean) {
  return active
    ? 'bg-emerald-500 text-white shadow-sm'
    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data: result } = await api.get('/api/illustrated/mutations', { skipErrorToast: true } as any)
    if (!result?.ok)
      throw new Error(result?.error || '变异宝典读取失败')
    catalog.value = result.data
  }
  catch (cause: any) {
    error.value = cause?.response?.data?.error || cause?.message || '变异宝典读取失败'
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div v-if="error" class="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
      <p class="text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </p>
      <BaseButton class="mx-auto mt-3 w-28" variant="primary" :loading="loading" @click="load">
        重新读取
      </BaseButton>
    </div>

    <div v-else-if="loading && !catalog" class="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
      正在读取变异宝典...
    </div>

    <template v-else-if="catalog">
      <!-- 工具栏 -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="h-9 inline-flex overflow-hidden border border-gray-200 rounded-lg bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            v-for="item in tabs"
            :key="item.value"
            class="rounded-md px-3 text-sm font-medium transition"
            :class="segmentedClasses(tab === item.value)"
            @click="tab = item.value"
          >
            {{ item.label }}
          </button>
        </div>
        <input
          v-model="query"
          type="text"
          :placeholder="tab === 'collections' ? '搜索藏品或系列' : '搜索变异或效果'"
          class="h-9 min-w-0 flex-1 border border-gray-200 rounded-lg bg-white px-3 text-sm sm:flex-none sm:w-48 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 focus:border-emerald-500 focus:outline-none"
        >
        <BaseButton class="ml-auto" variant="primary" :loading="loading" @click="load">
          刷新
        </BaseButton>
      </div>

      <!-- 常规/装扮变异列表 -->
      <template v-if="tab !== 'collections'">
        <ul v-if="effects.length" class="overflow-hidden border border-gray-200 rounded-lg bg-white dark:border-gray-700 dark:bg-gray-800">
          <li
            v-for="effect in effects"
            :key="effect.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-gray-200 px-4 py-3 dark:border-gray-700 [&+&]:border-t"
          >
            <span class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-900/40">
              <img v-if="effect.image" :src="effect.image" alt="" class="h-4/5 w-4/5 object-contain" loading="lazy">
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold">
                {{ effect.name }}
              </h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {{ effect.description || '—' }}
              </p>
            </div>
            <span
              class="max-w-[40%] flex-none truncate rounded-full bg-emerald-50 px-2.5 text-xs text-emerald-700 font-medium leading-6 dark:bg-emerald-900/20 dark:text-emerald-300"
              :title="effect.effect"
            >
              {{ effect.effect }}
            </span>
            <div v-if="effect.probabilities.length" class="flex w-full flex-wrap gap-1 pl-[52px]" :aria-label="`${effect.name}变异概率`">
              <span
                v-for="probability in effect.probabilities"
                :key="probability.rarity || 0"
                class="inline-flex items-center gap-1 rounded bg-gray-50 px-1.5 text-[11px] text-gray-500 leading-5 dark:bg-gray-900/40 dark:text-gray-400"
              >
                {{ probability.rarity ? rarityNames[probability.rarity] : '触发' }}
                <b class="text-gray-700 tabular-nums dark:text-gray-200">{{ probability.percent }}%</b>
              </span>
            </div>
          </li>
        </ul>
        <div v-else class="border border-gray-200 rounded-lg border-dashed bg-white px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          没有符合条件的变异，换个搜索词试试。
        </div>
      </template>

      <!-- 藏品变异 -->
      <template v-else>
        <div class="flex flex-col gap-2 rounded-lg bg-gray-50 px-3.5 py-2.5 text-xs leading-relaxed text-gray-600 sm:flex-row sm:items-center sm:justify-between dark:bg-gray-900/40 dark:text-gray-300">
          <span class="flex items-start gap-1.5">
            <span class="i-carbon-information mt-0.5 flex-none text-emerald-500" />
            种在蓝晶土地上的作物有概率变异为藏品，各系列概率与保底次数见标题旁的问号。
          </span>
          <BaseButton class="shrink-0" variant="primary" @click="emit('goto-collections')">
            查看我的藏品
          </BaseButton>
        </div>

        <div v-for="entry in series" :key="entry.id" class="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <div class="mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-base font-bold">
                {{ entry.name }}
              </h3>
              <span class="rounded px-1.5 py-0.5 text-xs" :class="rarityClass(entry.rarityName)">{{ entry.rarityName }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ entry.items.length }} 款</span>
              <div v-if="entry.mutationRules.length" class="relative">
                <button
                  type="button"
                  class="i-carbon-help cursor-pointer text-base text-gray-400 hover:text-emerald-500"
                  :aria-label="`${entry.name}变异说明`"
                  @click.stop="openRulesId = openRulesId === entry.id ? null : entry.id"
                />
                <div
                  v-if="openRulesId === entry.id"
                  class="absolute left-0 top-6 z-20 min-w-56 border border-gray-200 rounded-lg bg-white p-3 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                  <p class="mb-2 font-bold">
                    藏品变异
                  </p>
                  <div v-for="rule in entry.mutationRules" :key="rule.name" class="flex flex-wrap gap-x-3 gap-y-1 py-0.5 text-gray-600 dark:text-gray-300">
                    <span>{{ rule.name }}</span>
                    <span>概率 <b class="text-emerald-600 dark:text-emerald-400">{{ rule.probability }}%</b></span>
                    <span>保底 <b class="text-emerald-600 dark:text-emerald-400">{{ rule.guarantee }}</b> 次</span>
                  </div>
                </div>
              </div>
            </div>
            <p v-if="entry.description" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ entry.description }}
            </p>
          </div>

          <div class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
            <div v-for="item in entry.items" :key="item.id" class="flex flex-col items-center border border-gray-200 rounded-xl p-2.5 text-center dark:border-gray-700">
              <span class="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-900/40">
                <img v-if="item.image" :src="item.image" :alt="item.name" class="h-4/5 w-4/5 object-contain" loading="lazy">
              </span>
              <span class="mt-1.5 max-w-full truncate text-xs font-medium">{{ item.name }}</span>
            </div>
          </div>
        </div>

        <div v-if="!series.length" class="border border-gray-200 rounded-lg border-dashed bg-white px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          没有符合条件的藏品，换个搜索词试试。
        </div>
      </template>
    </template>
  </div>
</template>
