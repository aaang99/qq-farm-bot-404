<script setup lang="ts">
import AccountModal from '@/components/AccountModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import DailyOverview from '@/components/DailyOverview.vue'
import BagPanel from '@/components/BagPanel.vue'
import { useBagStore } from '@/stores/bag'
import { useStatusStore } from '@/stores/status'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { getPlatformClass, getPlatformLabel } from '@/stores/account'



import { onMounted } from 'vue'

const statusStore = useStatusStore()
const userStore = useUserStore()
const bagStore = useBagStore()
const { status, dailyGifts } = storeToRefs(statusStore)

const showBagModal = ref(false)
const selectedBagAccount = ref<any>(null)

function openBagModalForAccount(acc: any) {
  emit('select', acc)
  selectedBagAccount.value = acc
  bagStore.fetchBag(String(acc.id))
  showBagModal.value = true
}

function closeBagModal() {
  showBagModal.value = false
  selectedBagAccount.value = null
}

const showTaskModal = ref(false)

function getAccountLevel(acc: any) {
  if (String(acc.id) === String(props.currentAccountId) && status.value?.status?.level !== undefined) {
    return status.value.status.level
  }
  return acc.level ?? acc.status?.level ?? 0
}

function getAccountTaskSummary(acc: any) {
  const gifts = (String(acc.id) === String(props.currentAccountId) ? dailyGifts.value?.gifts : null) || []
  if (!gifts.length) return { done: 0, total: 6 }
  const done = gifts.filter((g: any) => g.doneToday).length
  return { done, total: gifts.length }
}

onMounted(() => {
  if (props.currentAccountId) {
    statusStore.fetchStatus(String(props.currentAccountId))
    statusStore.fetchDailyGifts(String(props.currentAccountId))
  }
})

function openTaskModalForAccount(acc: any) {
  emit('select', acc)
  statusStore.fetchDailyGifts(String(acc.id))
  showTaskModal.value = true
}


const props = defineProps<{
  accounts: any[]
  accountsLoading: boolean
  currentAccountId: string | number | null | undefined
  userIsAdmin: boolean
  stoppedAccountsCount: number
  isAddAccountDisabled: boolean
  addAccountDisabledReason: string
  isAccountOpsDisabled: boolean
  showModal: boolean
  editingAccount: any
  showDeleteConfirm: boolean
  deleteLoading: boolean
  accountToDelete: any
  showClearStoppedConfirm: boolean
  clearStoppedLoading: boolean
  refreshWxCodesLoading: boolean
  defaultPlanSettingId: string
  defaultPlanApplyingId: string
}>()

const emit = defineEmits<{
  add: []
  clearStopped: []
  refreshWxCodes: []
  select: [account: any]
  toggle: [account: any]
  settings: [account: any]
  notification: [account: any]
  setDefaultPlan: [account: any]
  applyDefaultPlan: [account: any]
  edit: [account: any]
  delete: [account: any]
  saved: []
  closeModal: []
  closeDeleteConfirm: []
  confirmDelete: []
  closeClearStoppedConfirm: []
  confirmClearStopped: []
}>()

function accountAvatar(acc: any) {
  const direct = String(acc?.avatar || acc?.avatarUrl || acc?.avatar_url || '').trim()
  if (direct)
    return direct
  const qq = String(acc?.uin || acc?.qq || '').trim()
  if (/^\d+$/.test(qq))
    return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
  return ''
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h3 class="text-lg text-gray-900 font-bold dark:text-gray-100">
        账号管理
      </h3>
      <div class="flex flex-wrap gap-2">
        <BaseButton
          variant="outline"
          size="sm"
          :loading="refreshWxCodesLoading"
          :disabled="accountsLoading || accounts.length === 0"
          @click="emit('refreshWxCodes')"
        >
          <div class="i-carbon-renew mr-2" />
          <span class="hidden sm:inline">{{ userIsAdmin ? '刷新全部微信Code' : '刷新我的微信Code' }}</span>
          <span class="sm:hidden">刷新Code</span>
        </BaseButton>
        <BaseButton
          v-if="userIsAdmin"
          variant="secondary"
          size="sm"
          :disabled="stoppedAccountsCount === 0"
          @click="emit('clearStopped')"
        >
          <div class="i-carbon-trash-can mr-2" />
          <span class="hidden sm:inline">一键清理</span>
          <span class="sm:hidden">清理</span>
          ({{ stoppedAccountsCount }})
        </BaseButton>
        <BaseButton
          variant="primary"
          size="sm"
          :disabled="isAddAccountDisabled"
          :title="addAccountDisabledReason"
          @click="emit('add')"
        >
          <div class="i-carbon-add mr-2" />
          添加账号
        </BaseButton>
      </div>
    </div>

    <div v-if="accountsLoading && accounts.length === 0" class="py-8 text-center text-gray-500">
      <div i-svg-spinners-90-ring-with-bg class="mb-2 inline-block text-2xl" />
      <div>加载中...</div>
    </div>

    <div v-else-if="accounts.length === 0" class="rounded-lg bg-white py-12 text-center shadow dark:bg-gray-800">
      <div i-carbon-user-avatar class="mb-4 inline-block text-4xl text-gray-400" />
      <p class="mb-4 text-gray-500">
        暂无账号
      </p>
      <BaseButton
        variant="text"
        size="sm"
        :disabled="isAddAccountDisabled"
        :title="addAccountDisabledReason"
        @click="emit('add')"
      >
        立即添加
      </BaseButton>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="acc in accounts"
        :key="acc.id"
        class="cursor-pointer border rounded-lg bg-white p-3 shadow transition-all duration-200 dark:bg-gray-800 sm:p-4"
        :class="String(currentAccountId) === String(acc.id)
          ? 'ring-2'
          : 'border-transparent'"
        :style="String(currentAccountId) === String(acc.id)
          ? { borderColor: 'var(--theme-primary)', backgroundColor: 'rgba(var(--theme-primary-rgb, 59, 130, 246), 0.1)' }
          : {}"
        @click="emit('select', acc)"
      >
        <div class="flex items-center justify-between gap-2.5">
          <!-- 左侧：头像 + 真实昵称 + 平台 -->
          <div class="min-w-0 flex items-center gap-2.5 flex-1">
            <div class="h-10 w-10 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <img v-if="accountAvatar(acc)" :src="accountAvatar(acc)" class="h-full w-full object-cover">
              <div v-else class="i-carbon-user text-xl text-gray-400" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h4 class="truncate text-base font-bold">
                  {{ acc.nick || acc.name || acc.id }}
                </h4>

                <!-- 复刻概览页等级胶囊徽章 -->
                <span class="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  Lv.{{ getAccountLevel(acc) }}
                </span>

                <!-- 每日任务微胶囊（未完成显暖杏黄，全部完成显清爽翠绿） -->
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold font-mono transition-all active:scale-95 shadow-2xs leading-tight"
                  :class="getAccountTaskSummary(acc).done >= getAccountTaskSummary(acc).total && getAccountTaskSummary(acc).total > 0
                    ? 'border border-emerald-300/90 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border border-amber-200/90 bg-amber-50/80 text-amber-700 hover:bg-amber-100/90 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-300'"
                  title="查看每日礼包与任务进度"
                  @click.stop="openTaskModalForAccount(acc)"
                >
                  <div
                    class="i-carbon-gift text-[11px]"
                    :class="getAccountTaskSummary(acc).done >= getAccountTaskSummary(acc).total && getAccountTaskSummary(acc).total > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
                  />
                  <span>{{ getAccountTaskSummary(acc).done }}/{{ getAccountTaskSummary(acc).total }}</span>
                  <div class="i-carbon-chevron-down text-[9px] opacity-50 ml-0.5" />
                </button>
              </div>
              <div class="mt-0.5 flex items-center gap-2">
                <span
                  v-if="acc.platform"
                  class="rounded px-1.5 py-0.2 text-[10px] font-medium leading-tight"
                  :class="getPlatformClass(acc.platform)"
                >
                  {{ getPlatformLabel(acc.platform) }}
                </span>

                <!-- QQ 后边展示到期时间：小灰色字体 -->
                <span class="truncate text-xs text-gray-400 font-mono">
                  <span v-if="userStore.userCard">到期：{{ userStore.expireTimeText }}</span>
                  <span v-else>永久有效</span>
                </span>
              </div>
            </div>
          </div>

          <!-- 右侧：状态指示与启动/停止按钮（高度上移与头像完全齐平） -->
          <div class="flex items-center gap-2 shrink-0">
            <span class="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <div class="h-2 w-2 rounded-full" :class="acc.running ? 'bg-green-500 animate-pulse' : 'bg-gray-300'" />
              <span>{{ acc.running ? '运行中' : '已停止' }}</span>
            </span>
            <BaseButton
              variant="secondary"
              size="sm"
              class="border rounded-full shadow-sm transition-all duration-300 ease-in-out px-3 py-1 text-xs active:scale-95"
              :class="acc.running ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500 active:border-red-300 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400' : 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100 focus:ring-green-500 active:border-green-300 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'"
              :disabled="!acc.running && isAccountOpsDisabled"
              :title="!acc.running && isAccountOpsDisabled ? '账号已到期，无法启动账号' : ''"
              @click="emit('toggle', acc)"
            >
              <div :class="acc.running ? 'i-carbon-stop-filled' : 'i-carbon-play-filled'" class="mr-1 text-xs" />
              {{ acc.running ? '停止' : '启动' }}
            </BaseButton>
          </div>
        </div>

        <div class="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2.5 dark:border-gray-700/60">
          <!-- 左侧：拟物态胶囊按钮 (功能配置 绿色, 掉线通知 红色) -->
          <div class="flex items-center gap-2">
            <!-- 功能配置 -->
            <button
              type="button"
              class="neu-capsule-btn neu-green inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95"
              title="功能配置"
              @click="emit('settings', acc)"
            >
              <div class="i-carbon-settings text-xs" />
              <span>功能配置</span>
            </button>

            <!-- 掉线通知 -->
            <button
              type="button"
              class="neu-capsule-btn neu-red inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95"
              title="掉线通知"
              @click="emit('notification', acc)"
            >
              <div class="i-carbon-notification text-xs" />
              <span>掉线通知</span>
            </button>
          </div>

          <!-- 右侧：轻量操作图标 (我的背包, 编辑备注, 删除账号) -->
          <div class="flex items-center gap-1">
            <!-- 我的背包图标按钮 (点击唤起完整功能背包浮层) -->
            <BaseButton
              variant="ghost"
              class="group relative min-h-[32px] min-w-[32px] !p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              aria-label="我的背包"
              title="我的背包"
              @click="openBagModalForAccount(acc)"
            >
<svg viewBox="0 0 750 802" class="h-4.5 w-4.5 fill-current text-blue-600 hover:text-blue-700 dark:text-blue-400">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M748.9 615.5 L735.9 485.0 C733.4 458.0 710.4 437.4 683.4 437.4 L659.3 437.4 L643.3 220.9 C642.9 213.7 641.9 206.5 640.4 199.4 L640.4 198.9 C624.8 130.4 563.3 79.4 490.8 79.4 L464.8 79.4 C459.3 34.4 421.3 -0.6 374.8 -0.6 C328.3 -0.6 289.8 34.4 284.8 79.4 L258.8 79.4 C186.8 79.4 124.8 130.4 109.3 198.9 L109.3 199.4 C107.8 206.4 106.8 213.9 105.8 221.4 L89.8 438.0 L65.8 438.0 C38.6 437.7 15.8 458.4 13.3 485.5 L0.3 616.0 C-1.2 631.0 3.8 645.5 13.8 657.0 C23.6 668.2 37.8 674.6 52.8 674.5 L72.3 674.5 L70.2 699.0 C68.2 725.0 77.2 751.5 95.3 770.5 C113.2 789.9 138.4 800.9 164.8 801.0 L583.8 801.0 C610.2 801.0 635.5 790.0 653.3 770.5 C671.2 751.2 680.3 725.3 678.3 699.0 L676.3 674.5 L695.8 674.5 C710.8 674.5 724.8 668.0 734.8 657.0 C744.8 646.0 750.3 630.0 748.8 615.5 Z M374.3 48.4 C393.3 48.4 408.8 61.4 413.8 78.4 L335.3 78.4 C340.0 60.7 356.0 48.4 374.3 48.4 Z M249.6 124.6 L498.6 124.6 C549.9 124.6 588.5 158.9 599.7 205.6 C600.8 230.7 604.6 255.8 599.7 280.4 L576.7 396.3 C572.4 417.8 552.6 433.7 529.6 433.7 L511.4 433.7 L511.4 418.9 C511.4 404.5 499.6 393.2 484.6 393.2 C469.6 393.2 457.9 404.5 457.9 418.9 L457.9 433.7 L290.3 433.7 L290.3 418.9 C290.3 404.5 278.5 393.2 263.5 393.2 C248.5 393.2 236.7 404.5 236.7 418.9 L236.7 433.7 L218.5 433.7 C195.5 433.7 175.7 417.8 171.4 396.3 L148.4 280.4 C143.5 255.8 147.3 230.7 148.4 205.6 C160.1 159.5 198.2 124.6 249.6 124.6 Z M52.2 623.5 C51.3 623.5 50.7 623.0 50.2 622.5 C49.8 622.0 49.2 621.0 49.8 620.0 L62.7 489.5 C62.7 488.0 64.3 487.0 65.8 487.0 L86.2 487.0 L76.2 623.5 Z M618.0 745.0 C609.7 754.6 597.6 760.1 584.9 760.0 L164.9 760.0 C152.4 760.0 140.3 754.8 131.8 745.0 C123.3 735.3 118.8 722.9 119.8 710.0 L140.3 419.9 C154.3 457.0 189.4 482.3 229.0 482.3 L246.1 482.3 L246.1 519.4 C246.1 533.8 257.1 545.1 271.1 545.1 C285.2 545.1 296.2 533.8 296.2 519.4 L296.2 482.3 L453.1 482.3 L453.1 519.4 C453.1 533.8 464.1 545.1 478.2 545.1 C492.2 545.1 503.2 533.8 503.2 519.4 L503.2 482.3 L520.3 482.3 C559.9 482.3 595.0 457.0 609.0 419.9 L629.5 710.0 C630.6 722.8 626.5 735.4 618.0 745.0 Z M698.3 622.5 C697.8 623.0 697.1 623.4 696.3 623.5 L672.8 623.5 L662.8 487.0 L683.3 487.0 C684.8 487.0 686.3 488.0 686.3 489.5 L699.3 620.0 C699.3 621.0 699.3 622.0 698.3 622.5 Z M698.3 622.5" />
              </svg>
              <span class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 -translate-x-1/2 dark:bg-gray-100 dark:text-gray-900 group-focus-visible:opacity-100 group-hover:opacity-100">
                我的背包
              </span>
            </BaseButton>

            <BaseButton
              variant="ghost"
              class="group relative min-h-[32px] min-w-[32px] !p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="编辑备注"
              title="编辑备注"
              @click="emit('edit', acc)"
            >
              <div i-carbon-edit class="text-base" />
              <span class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 -translate-x-1/2 dark:bg-gray-100 dark:text-gray-900 group-focus-visible:opacity-100 group-hover:opacity-100">
                编辑
              </span>
            </BaseButton>

            <BaseButton
              variant="ghost"
              class="group relative min-h-[32px] min-w-[32px] text-red-500 !p-1.5 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
              aria-label="删除"
              title="删除"
              @click="emit('delete', acc)"
            >
              <div i-carbon-trash-can class="text-base" />
              <span class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 -translate-x-1/2 dark:bg-gray-100 dark:text-gray-900 group-focus-visible:opacity-100 group-hover:opacity-100">
                删除
              </span>
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <AccountModal
      :show="showModal"
      :edit-data="editingAccount"
      @close="emit('closeModal')"
      @saved="emit('saved')"
    />

    <ConfirmModal
      :show="showDeleteConfirm"
      :loading="deleteLoading"
      title="删除账号"
      :message="accountToDelete ? `确定要删除账号 ${accountToDelete.name || accountToDelete.id} 吗?` : ''"
      confirm-text="删除"
      type="danger"
      @close="!deleteLoading && emit('closeDeleteConfirm')"
      @cancel="!deleteLoading && emit('closeDeleteConfirm')"
      @confirm="emit('confirmDelete')"
    />

    <ConfirmModal
      :show="showClearStoppedConfirm"
      :loading="clearStoppedLoading"
      title="一键清理已停止账号"
      :message="`确定要清理 ${stoppedAccountsCount} 个已停止的账号吗？此操作不可恢复！`"
      confirm-text="确认清理"
      type="danger"
      @close="!clearStoppedLoading && emit('closeClearStoppedConfirm')"
      @cancel="!clearStoppedLoading && emit('closeClearStoppedConfirm')"
      @confirm="emit('confirmClearStopped')"
    />
  </div>

    <!-- 每日礼包与任务浮层 -->
    <Teleport to="body">
      <div v-if="showTaskModal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3 sm:p-5 backdrop-blur-sm" @click.self="showTaskModal = false">
        <div class="max-h-[85vh] max-w-lg w-full flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-white/70 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl animate-scale-in">
          <div class="flex items-center justify-between border-b border-gray-100/80 px-4 py-3 dark:border-gray-800">
            <div class="flex items-center gap-2">
              <div class="h-7 w-7 flex items-center justify-center rounded-lg bg-pink-50 text-pink-500 dark:bg-pink-950/40">
                <div class="i-carbon-gift text-base" />
              </div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">
                每日礼包 & 任务
              </h3>
            </div>
            <button
              class="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
              title="关闭"
              @click="showTaskModal = false"
            >
              <div class="i-carbon-close text-lg" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-3.5 sm:p-4">
            <DailyOverview :daily-gifts="dailyGifts" :hide-card="true" :show-growth="true" />
          </div>
        </div>
      </div>
    </Teleport>


    <!-- 我的背包浮层 (移植完整背包页面组件，带分类、批量出售、使用道具全套功能) -->
    <Teleport to="body">
      <div v-if="showBagModal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3 sm:p-5 backdrop-blur-sm" @click.self="closeBagModal">
        <div class="max-h-[90vh] max-w-4xl w-full flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-white/70 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl animate-scale-in">
          <!-- 头部 (带账号昵称与小号关闭按钮) -->
          <div class="flex items-center justify-between border-b border-gray-100/80 px-4 py-3 dark:border-gray-800">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <svg viewBox="0 0 750 802" class="h-4.5 w-4.5 fill-current text-blue-600 hover:text-blue-700 dark:text-blue-400">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M748.9 615.5 L735.9 485.0 C733.4 458.0 710.4 437.4 683.4 437.4 L659.3 437.4 L643.3 220.9 C642.9 213.7 641.9 206.5 640.4 199.4 L640.4 198.9 C624.8 130.4 563.3 79.4 490.8 79.4 L464.8 79.4 C459.3 34.4 421.3 -0.6 374.8 -0.6 C328.3 -0.6 289.8 34.4 284.8 79.4 L258.8 79.4 C186.8 79.4 124.8 130.4 109.3 198.9 L109.3 199.4 C107.8 206.4 106.8 213.9 105.8 221.4 L89.8 438.0 L65.8 438.0 C38.6 437.7 15.8 458.4 13.3 485.5 L0.3 616.0 C-1.2 631.0 3.8 645.5 13.8 657.0 C23.6 668.2 37.8 674.6 52.8 674.5 L72.3 674.5 L70.2 699.0 C68.2 725.0 77.2 751.5 95.3 770.5 C113.2 789.9 138.4 800.9 164.8 801.0 L583.8 801.0 C610.2 801.0 635.5 790.0 653.3 770.5 C671.2 751.2 680.3 725.3 678.3 699.0 L676.3 674.5 L695.8 674.5 C710.8 674.5 724.8 668.0 734.8 657.0 C744.8 646.0 750.3 630.0 748.8 615.5 Z M374.3 48.4 C393.3 48.4 408.8 61.4 413.8 78.4 L335.3 78.4 C340.0 60.7 356.0 48.4 374.3 48.4 Z M249.6 124.6 L498.6 124.6 C549.9 124.6 588.5 158.9 599.7 205.6 C600.8 230.7 604.6 255.8 599.7 280.4 L576.7 396.3 C572.4 417.8 552.6 433.7 529.6 433.7 L511.4 433.7 L511.4 418.9 C511.4 404.5 499.6 393.2 484.6 393.2 C469.6 393.2 457.9 404.5 457.9 418.9 L457.9 433.7 L290.3 433.7 L290.3 418.9 C290.3 404.5 278.5 393.2 263.5 393.2 C248.5 393.2 236.7 404.5 236.7 418.9 L236.7 433.7 L218.5 433.7 C195.5 433.7 175.7 417.8 171.4 396.3 L148.4 280.4 C143.5 255.8 147.3 230.7 148.4 205.6 C160.1 159.5 198.2 124.6 249.6 124.6 Z M52.2 623.5 C51.3 623.5 50.7 623.0 50.2 622.5 C49.8 622.0 49.2 621.0 49.8 620.0 L62.7 489.5 C62.7 488.0 64.3 487.0 65.8 487.0 L86.2 487.0 L76.2 623.5 Z M618.0 745.0 C609.7 754.6 597.6 760.1 584.9 760.0 L164.9 760.0 C152.4 760.0 140.3 754.8 131.8 745.0 C123.3 735.3 118.8 722.9 119.8 710.0 L140.3 419.9 C154.3 457.0 189.4 482.3 229.0 482.3 L246.1 482.3 L246.1 519.4 C246.1 533.8 257.1 545.1 271.1 545.1 C285.2 545.1 296.2 533.8 296.2 519.4 L296.2 482.3 L453.1 482.3 L453.1 519.4 C453.1 533.8 464.1 545.1 478.2 545.1 C492.2 545.1 503.2 533.8 503.2 519.4 L503.2 482.3 L520.3 482.3 C559.9 482.3 595.0 457.0 609.0 419.9 L629.5 710.0 C630.6 722.8 626.5 735.4 618.0 745.0 Z M698.3 622.5 C697.8 623.0 697.1 623.4 696.3 623.5 L672.8 623.5 L662.8 487.0 L683.3 487.0 C684.8 487.0 686.3 488.0 686.3 489.5 L699.3 620.0 C699.3 621.0 699.3 622.0 698.3 622.5 Z M698.3 622.5" />
              </svg>
              </div>
              <div>
                <h3 class="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                  我的背包
                </h3>
                <p v-if="selectedBagAccount" class="text-[11px] text-gray-400">
                  正在查看：{{ selectedBagAccount.nick || selectedBagAccount.name || selectedBagAccount.id }}
                </p>
              </div>
            </div>
            <!-- 右上角小尺寸关闭按钮 -->
            <button
              class="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
              title="关闭"
              @click="closeBagModal"
            >
              <div class="i-carbon-close text-lg" />
            </button>
          </div>

          <!-- 内容区域：原生 BagPanel 完整功能无缝嵌入 -->
          <div class="flex-1 overflow-y-auto p-3 sm:p-5">
            <BagPanel />
          </div>
        </div>
      </div>
    </Teleport>

</template>

<style scoped>
/* 拟物态微立体胶囊按钮 */
.neu-capsule-btn {
  border: 1.5px solid transparent;
  box-shadow: 
    inset 0 1px 1px rgba(255, 255, 255, 0.9),
    0 2px 5px rgba(0, 0, 0, 0.06);
}

.neu-green {
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
  color: #15803d;
}
.neu-green:hover {
  background: linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%);
  border-color: #4ade80;
  box-shadow: 
    inset 0 1px 1px rgba(255, 255, 255, 1),
    0 3px 8px rgba(34, 197, 94, 0.2);
}

.neu-red {
  background: linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%);
  border-color: #fca5a5;
  color: #b91c1c;
}
.neu-red:hover {
  background: linear-gradient(180deg, #fee2e2 0%, #fecaca 100%);
  border-color: #f87171;
  box-shadow: 
    inset 0 1px 1px rgba(255, 255, 255, 1),
    0 3px 8px rgba(239, 68, 68, 0.2);
}

.dark .neu-green {
  background: linear-gradient(180deg, rgba(20, 83, 45, 0.35) 0%, rgba(20, 83, 45, 0.6) 100%);
  border-color: rgba(74, 222, 128, 0.4);
  color: #86efac;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 2px 5px rgba(0, 0, 0, 0.3);
}

.dark .neu-red {
  background: linear-gradient(180deg, rgba(127, 29, 29, 0.35) 0%, rgba(127, 29, 29, 0.6) 100%);
  border-color: rgba(248, 113, 113, 0.4);
  color: #fca5a5;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 2px 5px rgba(0, 0, 0, 0.3);
}
</style>
