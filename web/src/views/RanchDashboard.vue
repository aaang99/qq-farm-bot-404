<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import RuntimeLogPanel from '@/components/shared/RuntimeLogPanel.vue'
import { useRanchResource } from '@/composables/useRanchResource'
import { useRanchSync } from '@/composables/useRanchSync'
import { useAccountStore } from '@/stores/account'
import { useStatusStore } from '@/stores/status'
import { useUserStore } from '@/stores/user'
import { formatCouponAmount } from '@/utils/number-format'
import { ranchActionLabels, ranchTodayOperations } from '@/utils/ranch-display'

const ranch = useRanchSync()
const account = useAccountStore()
const status = useStatusStore()
const userStore = useUserStore()
const profile = useRanchResource(ref('profile'))
const illustrated = useRanchResource(ref('illustrated'))
const normalIllustratedIcon = '/game-config/ranch-icons/illustrated-normal.png'
const clock = ref(Date.now())
// 与农场 Dashboard.vue 一致：后端每轮 status_sync 下发剩余秒数，本地每秒递减，避免整块变红
const localRemain = ref<Record<string, number>>({ farm: 0, help: 0, steal: 0 })
const localHold = ref<Record<string, string>>({ farm: '', help: '', steal: '' })

function syncRemain(key: string, total: number) {
  const prev = localRemain.value[key] || 0
  // 后端重置了周期（或首次赋值）时整体对齐，否则保留本地更小的值，防止倒计时回跳
  localRemain.value[key] = total > prev ? total : Math.max(0, prev)
}

watch(() => status.status?.nextChecks, (nc: any) => {
  if (!nc)
    return
  syncRemain('farm', Number(nc.farmRemainSec) || 0)
  syncRemain('help', Number(nc.helpRemainSec) || 0)
  syncRemain('steal', Number(nc.stealRemainSec) || 0)
  localHold.value = {
    farm: String(nc.farmHold || ''),
    help: String(nc.helpHold || ''),
    steal: String(nc.stealHold || ''),
  }
}, { deep: true })

useIntervalFn(() => {
  clock.value = Date.now()
  for (const key of ['farm', 'help', 'steal']) {
    if ((localRemain.value[key] || 0) > 0)
      localRemain.value[key] = localRemain.value[key] - 1
  }
}, 1000)
const currentAccountDisconnected = computed(() => status.currentStatusReady && !status.status?.connection?.connected)
const checks = computed(() => [
  { key: 'farm', label: '牧场', icon: 'i-fas-paw', color: '#22c55e', text: 'text-green-500' },
  { key: 'help', label: '帮助', icon: 'i-carbon-user-multiple', color: '#3b82f6', text: 'text-blue-500' },
  { key: 'steal', label: '偷取', icon: 'i-carbon-run', color: '#f97316', text: 'text-orange-500' },
].map((item) => {
  const nc = status.status?.nextChecks
  const remain = localRemain.value[item.key] || 0
  const hold = localHold.value[item.key] || ''
  // 后端已明确告知暂停/未启用时优先展示原因，避免一直显示“检查中…”
  let value: string
  if (currentAccountDisconnected.value)
    value = '账号未登录'
  else if (!nc)
    value = '读取中'
  else if (hold === 'disabled')
    value = '未开启'
  else if (hold === 'paused')
    value = '已暂停'
  else if (hold === 'unhealthy')
    value = '连接异常'
  else if (hold === 'running' || remain === 0)
    value = '检查中…'
  else
    value = formatDuration(remain)
  return { ...item, value, progress: 0 }
}))
const displayName = computed(() => {
  // 与农场一致：只显示昵称，不附带账号备注
  const name = profile.data.value?.name || account.currentAccount?.nick
  return name || account.currentAccount?.name || '未登录'
})

// 与农场概览共用同一套头像取值逻辑
const avatarLoadFailed = ref(false)
function liveAccountAvatar() {
  if (!status.currentStatusReady)
    return ''
  return String(
    status.status?.status?.avatar
    || status.status?.status?.avatarUrl
    || status.status?.status?.avatar_url
    || '',
  ).trim()
}
const currentAvatar = computed(() => {
  const acc = account.currentAccount
  if (!acc)
    return '/default-user-avatar.png'
  const explicit = liveAccountAvatar() || String(acc.avatar || '').trim()
  if (explicit)
    return explicit
  const qq = String(acc.uin || acc.qq || '').trim()
  if (qq && /^\d+$/.test(qq))
    return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
  return '/default-user-avatar.png'
})
watch(() => account.currentAccountId, () => {
  avatarLoadFailed.value = false
})
function getExpPercent(progress: any) {
  return progress?.needed ? Math.max(0, Math.min(100, progress.current / progress.needed * 100)) : 0
}
function itemCount(id: number) {
  if (!ranch.data || ranch.data.sectionErrors?.warehouse)
    return null
  return (ranch.data.items || []).filter((item: any) => Number(item.id) === id).reduce((sum: bigint, item: any) => sum + BigInt(item.count || 0), 0n).toString()
}
const assets = computed(() => [
  { name: '金券', icon: '', image: '/game-config/seed_images_named/1007.png', value: itemCount(1007), color: 'text-yellow-600 dark:text-yellow-500' },
  { name: '松果', icon: '', image: '/game-config/seed_images_named/1008.png', value: itemCount(1008), color: 'text-amber-500 dark:text-amber-400' },
  { name: '点券', icon: '', image: '/game-config/resource-icons/coupon.png', value: status.currentStatusReady ? status.status?.status?.coupon : null, color: 'text-emerald-500 dark:text-emerald-400' },
  { name: '钻石', icon: '', image: '/game-config/resource-icons/diamond.png', value: status.currentStatusReady ? status.status?.status?.diamond : null, color: 'text-cyan-600 dark:text-cyan-400' },
].map(item => ({ ...item, value: item.value == null ? (ranch.hydrated ? '—' : '…') : formatCouponAmount(item.value) })))
const cans = computed(() => [7003, 7004].map((id, index) => ({ name: index ? '有机罐头时长' : '普通罐头时长', icon: `/game-config/ranch-icons/can-${index ? 'organic' : 'normal'}.png`, value: itemCount(id) == null ? (ranch.hydrated ? '—' : '…') : `${(Number(itemCount(id)) / 3600).toFixed(1)}h` })))
const illustratedLevels = computed(() => {
  const data: any = illustrated.data.value
  const normalLevel = data?.levels?.currentLevel
  // 巨大图鉴：weightScore 只有 currentId（0 表示尚未解锁任何等级）与 totalScore
  const giantId = data?.weightScore?.currentId
  return {
    normal: normalLevel == null ? (ranch.hydrated ? '—' : '…') : `Lv.${normalLevel}`,
    giant: !illustrated.hydrated.value ? '…' : (!giantId ? '未解锁' : `Lv.${giantId}`),
  }
})
const operationIcons: Record<string, { icon: string, color?: string }> = {
  collect: { icon: 'i-carbon-shopping-bag' },
  harvest: { icon: 'i-carbon-crop-growth' },
  clean: { icon: 'i-carbon-clean' },
  place: { icon: 'i-fas-paw' },
  produce: { icon: 'i-carbon-play' },
  addFeed: { icon: 'i-carbon-sprout' },
  submitOrder: { icon: 'i-carbon-task-complete' },
  refreshOrder: { icon: 'i-carbon-renew' },
  claimIllustrated: { icon: 'i-carbon-gift' },
  claimWeight: { icon: 'i-carbon-trophy' },
  steal: { icon: 'i-carbon-run' },
  help: { icon: 'i-carbon-user-multiple' },
  stroke: { icon: 'i-carbon-favorite' },
  sell: { icon: 'i-carbon-shopping-cart' },
  buy: { icon: 'i-carbon-shopping-cart' },
  useCan: { icon: 'i-carbon-chemistry', color: 'text-green-500' },
}
const filteredOperations = computed(() => ranchTodayOperations(ranch.data?.operations, ranch.data?.operationsDate, clock.value))
function formatDuration(seconds: number) {
  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
  return `${pad(seconds / 3600)}:${pad(seconds % 3600 / 60)}:${pad(seconds % 60)}`
}
</script>

<template>
  <div class="flex flex-col gap-5 pt-1 md:h-full md:min-h-0 md:overflow-hidden md:pt-2">
    <div v-if="!account.currentAccountId" class="ui-card rounded-lg p-8 text-center text-gray-500">
      请先选择账号
    </div>
    <p v-else-if="ranch.error && ranch.error !== '账号未运行'" class="text-sm text-red-500" role="alert">
      {{ ranch.error }}
    </p>
    <!-- 一体化牧场概览卡片（集成：身份、等级、经验、核心资产、罐头、图鉴） -->
    <div class="ui-card relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all shadow-md">
      <!-- 顶部：身份、等级、在线状态与运行时长 -->
      <div class="flex items-center justify-between gap-2 border-b border-gray-100/70 pb-2.5 dark:border-gray-800/70">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="h-10 w-10 flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-green-500/10 text-green-600 ring-2 ring-white/80 shadow-md dark:bg-green-400/20 dark:text-green-300">
            <img
              v-if="!avatarLoadFailed"
              :src="currentAvatar"
              :alt="displayName"
              referrerpolicy="no-referrer"
              class="h-full w-full object-cover"
              @error="avatarLoadFailed = true"
            >
            <div v-else class="h-full w-full flex items-center justify-center font-bold text-sm">
              {{ displayName.slice(0, 1) }}
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-base font-bold sm:text-lg" :title="displayName">
                {{ displayName }}
              </span>
              <span class="shrink-0 rounded-md bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                Lv.{{ profile.data.value?.level ?? '—' }}
              </span>
            </div>

            <!-- 第二行：平台胶囊 + 到期时间（与农场概览一致） -->
            <div class="mt-0.5 flex items-center gap-2">
              <span
                class="rounded px-1.5 py-0.2 text-[10px] font-medium leading-tight shrink-0"
                :class="(account.currentAccount?.platform || status.status?.status?.platform) === 'wx'
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'"
              >
                {{ (account.currentAccount?.platform || status.status?.status?.platform) === 'wx' ? '微信' : 'QQ' }}
              </span>

              <span class="truncate text-xs text-gray-400 font-mono">
                <span v-if="userStore.userCard">到期：{{ userStore.expireTimeText }}</span>
                <span v-else>永久有效</span>
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          <div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" :class="status.status?.connection?.connected ? 'bg-green-100/80 text-green-700 dark:bg-green-900/30 dark:text-green-300' : currentStatusReady ? 'bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'">
            <span class="h-2 w-2 rounded-full" :class="status.status?.connection?.connected ? 'bg-green-500 animate-pulse' : currentStatusReady ? 'bg-red-500' : 'bg-gray-400'" />
            <span>{{ status.status?.connection?.connected ? '在线' : currentStatusReady ? '离线' : '检查中' }}</span>
          </div>
          <div class="flex items-center gap-1 text-xs text-gray-400 font-mono">
            <div class="i-fas-clock text-purple-400" />
            <span>{{ formatDuration(status.status?.uptime || 0) }}</span>
          </div>
        </div>
      </div>

      <!-- 经验条 -->
      <div class="py-2">
        <div class="mb-1.5 flex items-center justify-between text-xs text-gray-500 font-mono">
          <span class="flex items-center gap-1">
            <span class="i-fas-bolt text-amber-500 text-[11px]" />
            <span class="font-semibold text-gray-600 dark:text-gray-300">经验 EXP</span>
          </span>

          <span class="font-medium text-gray-600 dark:text-gray-300">
            {{ profile.data.value?.levelProgress?.current ?? profile.data.value?.exp ?? 0 }} / {{ profile.data.value?.levelProgress?.needed ?? '?' }}
          </span>
        </div>

        <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            class="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
            :class="{ 'animate-pulse': !profile.hydrated.value && profile.loading.value }"
            :style="{ width: `${getExpPercent(profile.data.value?.levelProgress)}%` }"
          />
        </div>
        <div v-if="!profile.hydrated.value && profile.loading.value" class="mt-1 text-[10px] text-gray-400">
          正在读取牧场资料…
        </div>
        <div v-else-if="profile.error.value" class="mt-1 text-[10px] text-gray-400">
          牧场资料读取失败
        </div>
      </div>

      <!-- 核心资产：4 宫格数据矩阵 -->
      <div class="grid grid-cols-4 gap-2 py-2">
        <div v-for="asset in assets" :key="asset.name" class="flex flex-col items-center justify-center rounded-xl bg-gray-50/70 py-2 dark:bg-gray-800/40">
          <div class="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
            <img v-if="asset.image" :src="asset.image" :alt="asset.name" class="h-4 w-4 shrink-0 object-contain">
            <div v-else :class="[asset.icon, 'text-[15px]']" />
            <span>{{ asset.name }}</span>
          </div>
          <div class="text-base font-bold sm:text-lg truncate max-w-full px-1" :class="asset.color">
            {{ asset.value }}
          </div>
        </div>
      </div>

      <!-- 辅助物资与图鉴（紧凑胶囊通栏：普通罐头、普通图鉴、有机罐头、巨大图鉴） -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100/70 dark:border-gray-800/70">
        <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
          <div class="flex items-center gap-1.5 text-xs text-gray-500">
            <img src="/game-config/ranch-icons/can-normal.png" alt="普通罐头" class="h-4 w-4 shrink-0 object-contain">
            <span>普通罐头</span>
          </div>
          <span class="text-xs font-bold text-gray-700 dark:text-gray-200">{{ cans[0]?.value }}</span>
        </div>

        <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
          <div class="flex items-center gap-1.5 text-xs text-gray-500">
            <img :src="normalIllustratedIcon" alt="普通图鉴" class="ranch-illustrated-icon h-4 w-4 shrink-0 object-contain">
            <span>普通图鉴</span>
          </div>
          <span class="text-xs font-bold text-gray-700 dark:text-gray-200">{{ illustratedLevels.normal }}</span>
        </div>

        <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
          <div class="flex items-center gap-1.5 text-xs text-gray-500">
            <img src="/game-config/ranch-icons/can-organic.png" alt="有机罐头" class="h-4 w-4 shrink-0 object-contain">
            <span>有机罐头</span>
          </div>
          <span class="text-xs font-bold text-gray-700 dark:text-gray-200">{{ cans[1]?.value }}</span>
        </div>

        <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
          <div class="flex items-center gap-1.5 text-xs text-gray-500">
            <img src="/game-config/ranch-icons/illustrated-giant.png" alt="巨大图鉴" class="ranch-illustrated-icon h-4 w-4 shrink-0 object-contain">
            <span>巨大图鉴</span>
          </div>
          <span class="text-xs font-bold text-gray-700 dark:text-gray-200">{{ illustratedLevels.giant }}</span>
        </div>
      </div>
    </div>

    <div class="flex flex-1 flex-col items-stretch gap-5 md:min-h-0 md:flex-row">
      <div class="flex flex-1 flex-col gap-5 md:min-h-0 md:w-3/4">
        <RuntimeLogPanel scene="ranch" />
      </div>

      <div class="flex flex-col gap-4 md:min-h-0 md:w-1/4 md:overflow-hidden">
        <div class="ui-card flex shrink-0 flex-col rounded-lg p-3.5">
          <h3 class="mb-3 flex items-center gap-2 text-base font-medium 2xl:text-lg">
            <div class="i-carbon-hourglass" />
            <span>下次检查倒计时</span>
          </h3>
          <div class="grid grid-cols-3 gap-2">
            <div v-for="check in checks" :key="check.key" class="min-w-0 flex flex-col items-center text-center">
              <div class="h-18 w-18 flex items-center justify-center rounded-full p-1" :style="{ background: `conic-gradient(${check.color} ${check.progress}%, color-mix(in srgb, ${check.color} 14%, transparent) 0)` }">
                <div class="h-full w-full flex flex-col items-center justify-center rounded-full bg-white dark:bg-gray-800">
                  <div class="text-xl" :class="[check.icon, check.text]" /><span class="mt-0.5 text-xs text-gray-500">{{ check.label }}</span>
                </div>
              </div>
              <div class="mt-1.5 w-full truncate text-sm font-bold font-mono 2xl:text-base" :title="check.value">
                {{ check.value }}
              </div>
            </div>
          </div>
        </div>

        <div class="ui-card min-h-0 flex flex-1 flex-col overflow-hidden rounded-lg p-4">
          <h3 class="mb-3 flex items-center gap-2 text-base font-medium 2xl:text-lg">
            <div class="i-carbon-chart-column" />
            <span>今日统计</span>
          </h3>
          <p class="mb-2 text-[10px] text-gray-400">
            今日请求完成数（不含启动前历史）
          </p>
          <div v-if="currentAccountDisconnected" class="ui-subtle-panel flex flex-col items-center justify-center gap-3 rounded-lg p-5 text-center text-gray-500">
            <div class="i-carbon-connection-signal-off text-4xl text-gray-400" />
            <div class="flex flex-col">
              <div class="text-lg text-gray-700 font-medium dark:text-gray-300">
                账号未登录
              </div>
              <div class="mt-1 text-sm text-gray-400">
                请先运行账号或检查网络连接。
              </div>
            </div>
          </div>
          <div v-else class="grid auto-rows-fr grid-cols-2 min-h-0 flex-1 gap-1.5 overflow-y-auto 2xl:gap-2">
            <div
              v-for="(val, key) in filteredOperations"
              :key="key"
              class="ui-subtle-panel min-w-0 flex items-center justify-between rounded-lg px-2 py-1.5"
            >
              <div class="min-w-0 flex items-center gap-1.5">
                <div class="text-base text-green-500 2xl:text-lg" :class="[operationIcons[key]?.icon || 'i-carbon-chart-column']" />
                <div class="truncate text-xs text-gray-500 2xl:text-sm" :title="ranchActionLabels[key] || String(key)">
                  {{ ranchActionLabels[key] || key }}
                </div>
              </div>
              <div class="text-sm font-bold 2xl:text-base">
                {{ val }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The official pale-yellow artwork needs stronger separation on the overview card. */
.ranch-illustrated-icon {
  filter: brightness(0.82) saturate(1.3);
}
</style>
