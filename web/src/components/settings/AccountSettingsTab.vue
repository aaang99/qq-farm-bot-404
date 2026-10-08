<script setup lang="ts">
import AccountModal from '@/components/AccountModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { getPlatformClass, getPlatformLabel } from '@/stores/account'

defineProps<{
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
              <h4 class="truncate text-base font-bold">
                {{ acc.nick || acc.name || acc.id }}
              </h4>
              <div class="mt-0.5 flex items-center gap-1.5">
                <span
                  v-if="acc.platform"
                  class="rounded px-1.5 py-0.2 text-[10px] font-medium leading-tight"
                  :class="getPlatformClass(acc.platform)"
                >
                  {{ getPlatformLabel(acc.platform) }}
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

          <!-- 右侧：轻量操作图标 (编辑备注, 删除账号) -->
          <div class="flex items-center gap-1">
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
