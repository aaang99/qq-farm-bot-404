<script setup lang="ts">
import type { Account } from '@/stores/account'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import api from '@/api'
import AccountCareerModal from '@/components/AccountCareerModal.vue'
import AccountModal from '@/components/AccountModal.vue'
import RemarkModal from '@/components/RemarkModal.vue'
import { getPlatformClass, getPlatformLabel, useAccountStore } from '@/stores/account'
import { useStatusStore } from '@/stores/status'

const accountStore = useAccountStore()
const statusStore = useStatusStore()
const { accounts, currentAccount } = storeToRefs(accountStore)
const { currentStatusReady, status } = storeToRefs(statusStore)

const showAccountDropdown = ref(false)
const showAccountModal = ref(false)
const showRemarkModal = ref(false)
const showCareerModal = ref(false)
const careerLoading = ref(false)
const careerError = ref('')
const careerItems = ref<any[]>([])
const careerProfile = ref<Record<string, any>>({})
const accountToEdit = ref<any>(null)
const failedAvatars = ref(new Set<string>())

const triggerRef = useTemplateRef<HTMLElement>('trigger')
const dropdownPos = ref({ top: 0, left: 0, width: 320 })

function onScroll() {
  if (showAccountDropdown.value) {
    updateDropdownPos()
  }
}

function onResize() {
  if (showAccountDropdown.value) {
    updateDropdownPos()
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
})

const isOnline = computed(() => {
  return !!status.value?.connection?.connected
})

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function liveAccountName() {
  if (!currentStatusReady.value)
    return ''
  const name = cleanText(status.value?.status?.name)
  return name && name !== '未登录' ? name : ''
}

function liveAccountAvatar() {
  if (!currentStatusReady.value)
    return ''
  return cleanText(
    status.value?.status?.avatar
    || status.value?.status?.avatarUrl
    || status.value?.status?.avatar_url,
  )
}

function accountDisplayName(acc?: Account | null) {
  if (!acc)
    return '选择账号'

  const liveName = currentAccount.value?.id === acc.id ? liveAccountName() : ''
  const nick = cleanText(liveName || acc.nick)
  const remark = cleanText(acc.name)
  if (nick && remark && nick !== remark)
    return `${nick} (${remark})`
  if (nick)
    return nick
  if (remark)
    return remark
  return cleanText(acc.uin || acc.qq || acc.id) || '选择账号'
}

function accountSubtitle(acc?: Account | null) {
  if (!acc)
    return ''
  return cleanText(acc.uin || acc.qq || acc.id)
}

function avatarSource(acc?: Account | null) {
  if (!acc)
    return ''
  const explicit = currentAccount.value?.id === acc.id
    ? cleanText(liveAccountAvatar() || acc.avatar)
    : cleanText(acc.avatar)
  if (explicit)
    return explicit
  const qq = cleanText(acc.uin || acc.qq)
  if (qq && /^\d+$/.test(qq))
    return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
  return ''
}

function avatarKey(acc?: Account | null) {
  return cleanText(acc?.id || acc?.uin || acc?.qq || acc?.wxid || '')
}

function shouldShowAvatar(acc?: Account | null) {
  const key = avatarKey(acc)
  return !!avatarSource(acc) && !!key && !failedAvatars.value.has(key)
}

function markAvatarFailed(acc?: Account | null) {
  const key = avatarKey(acc)
  if (!key)
    return
  const next = new Set(failedAvatars.value)
  next.add(key)
  failedAvatars.value = next
}

function avatarInitial(acc?: Account | null) {
  return accountDisplayName(acc).replace(/[()（）\s]/g, '').slice(0, 1) || '账'
}

async function loadCareer() {
  const accountId = cleanText(currentAccount.value?.id)
  if (!accountId)
    return
  careerLoading.value = true
  careerError.value = ''
  try {
    const { data } = await api.get('/api/career', {
      headers: { 'x-account-id': accountId },
    })
    if (!data?.ok)
      throw new Error(data?.error || '生涯记录读取失败')
    careerProfile.value = data.data || {}
    careerItems.value = data.data?.items || []
  }
  catch (error: any) {
    careerError.value = error?.response?.data?.error || error?.message || '生涯记录读取失败'
  }
  finally {
    careerLoading.value = false
  }
}

function openCareer(event: MouseEvent) {
  event.stopPropagation()
  if (!currentAccount.value)
    return
  closeDropdown()
  showCareerModal.value = true
  loadCareer()
}

const displayName = computed(() => accountDisplayName(currentAccount.value))
const currentAvatarSrc = computed(() => avatarSource(currentAccount.value))

async function openDropdown() {
  updateDropdownPos()
  showAccountDropdown.value = true
  await nextTick()
  updateDropdownPos()
}

function closeDropdown() {
  showAccountDropdown.value = false
}

function toggleDropdown() {
  if (showAccountDropdown.value) {
    closeDropdown()
    return
  }
  openDropdown()
}

function updateDropdownPos() {
  const el = triggerRef.value
  if (!el)
    return

  const rect = el.getBoundingClientRect()
  const viewportGap = 8
  const width = Math.min(300, window.innerWidth - viewportGap * 2)
  const left = Math.min(
    Math.max(viewportGap, rect.right - width),
    window.innerWidth - width - viewportGap,
  )

  dropdownPos.value = {
    top: rect.bottom + viewportGap,
    left,
    width,
  }
}

function selectAccount(acc: any) {
  accountStore.setCurrentAccount(acc)
  closeDropdown()
}

function openAddAccount() {
  accountToEdit.value = null
  showAccountModal.value = true
  closeDropdown()
}

function openRemarkModal(acc: any) {
  accountToEdit.value = acc
  showRemarkModal.value = true
  closeDropdown()
}

async function handleAccountSaved() {
  await accountStore.fetchAccounts()
  showAccountModal.value = false
  showRemarkModal.value = false
  accountToEdit.value = null
}
</script>

<template>
  <div class="relative">
    <!-- 液态玻璃头像胶囊框：无文字，只留头像与下拉指示微标 -->
    <button
      ref="trigger"
      class="liquid-capsule-btn flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-all duration-200"
      title="切换账号"
      @click="toggleDropdown"
    >
      <div class="relative h-8 w-8 flex-none">
        <div
          class="h-full w-full flex items-center justify-center overflow-hidden rounded-full cursor-pointer ring-2 ring-white/90 shadow-sm transition-transform duration-200 hover:scale-105"
          @click.stop="openCareer"
        >
          <img
            v-if="shouldShowAvatar(currentAccount)"
            :src="currentAvatarSrc"
            :alt="displayName"
            class="h-full w-full object-cover"
            @error="markAvatarFailed(currentAccount)"
          >
          <span v-else class="text-xs font-bold text-gray-700 dark:text-gray-200">
            {{ avatarInitial(currentAccount) }}
          </span>
        </div>
        <!-- 运行在线指示灯 -->
        <span
          v-if="currentAccount"
          class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 pointer-events-none"
          :class="isOnline ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-400'"
        />
      </div>

      <div
        class="i-carbon-chevron-down text-xs text-gray-500 opacity-70 transition-transform duration-200 mr-1"
        :class="{ 'rotate-180': showAccountDropdown }"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="showAccountDropdown"
        class="fixed inset-0 z-[9998] bg-transparent"
        @click="closeDropdown"
      />

      <div
        v-if="showAccountDropdown"
        class="liquid-dropdown-menu fixed z-[9999] overflow-hidden rounded-2xl py-2 shadow-2xl backdrop-blur-2xl"
        :style="{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px`, width: `${dropdownPos.width}px` }"
      >
        <div class="custom-scrollbar max-h-72 overflow-y-auto px-1.5 space-y-1">
          <template v-if="accounts.length > 0">
            <button
              v-for="acc in accounts"
              :key="acc.id || acc.uin"
              class="liquid-account-row w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all"
              :class="{ 'liquid-account-row-active': currentAccount?.id === acc.id }"
              @click="selectAccount(acc)"
            >
              <div class="h-8 w-8 flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/60 shadow-sm bg-white/50">
                <img
                  v-if="shouldShowAvatar(acc)"
                  :src="avatarSource(acc)"
                  :alt="accountDisplayName(acc)"
                  class="h-full w-full object-cover"
                  @error="markAvatarFailed(acc)"
                >
                <span v-else class="text-xs font-bold text-gray-600 dark:text-gray-300">
                  {{ avatarInitial(acc) }}
                </span>
              </div>
              <div class="min-w-0 flex flex-1 flex-col items-start">
                <span class="w-full truncate text-left text-xs font-bold" style="color: var(--theme-text);">
                  {{ accountDisplayName(acc) }}
                </span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span
                    v-if="getPlatformLabel(acc.platform)"
                    class="rounded px-1 py-0.2 text-[9px] font-medium leading-tight"
                    :class="getPlatformClass(acc.platform)"
                  >
                    {{ getPlatformLabel(acc.platform) }}
                  </span>
                  <span v-if="accountSubtitle(acc)" class="text-[11px] opacity-60 font-mono" style="color: var(--theme-text);">{{ accountSubtitle(acc) }}</span>
                </div>
              </div>
              <button
                class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/60 hover:text-blue-500"
                title="修改备注"
                @click.stop="openRemarkModal(acc)"
              >
                <div class="i-carbon-edit text-xs" />
              </button>
              <div v-if="currentAccount?.id === acc.id" class="i-carbon-checkmark text-blue-500 font-bold shrink-0" />
            </button>
          </template>
          <div v-else class="px-4 py-4 text-center text-xs opacity-60">
            暂无账号
          </div>
        </div>
        <div class="mt-2 border-t border-white/40 pt-1.5 px-1.5 flex gap-1 dark:border-white/10">
          <button
            class="liquid-btn-action flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold text-blue-600 transition-colors"
            @click="openAddAccount"
          >
            <div class="i-carbon-add text-sm" />
            <span>添加账号</span>
          </button>
          <router-link
            to="/settings"
            class="liquid-btn-action flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold text-blue-600 transition-colors"
            @click="closeDropdown"
          >
            <div class="i-carbon-settings text-sm" />
            <span>管理账号</span>
          </router-link>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <AccountModal
        :show="showAccountModal"
        :edit-data="accountToEdit"
        @close="showAccountModal = false; accountToEdit = null"
        @saved="handleAccountSaved"
      />

      <RemarkModal
        :show="showRemarkModal"
        :account="accountToEdit"
        @close="showRemarkModal = false"
        @saved="handleAccountSaved"
      />

      <AccountCareerModal
        :show="showCareerModal"
        :account="currentAccount"
        :profile="careerProfile"
        :items="careerItems"
        :loading="careerLoading"
        :error="careerError"
        @close="showCareerModal = false"
        @refresh="loadCareer"
      />
    </Teleport>
  </div>
</template>

<style scoped>
/* 液态玻璃胶囊框 */
.liquid-capsule-btn {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  box-shadow:
    inset 0 1px 1.5px rgba(255, 255, 255, 0.95),
    0 4px 16px rgba(15, 23, 42, 0.06);
}

.dark .liquid-capsule-btn {
  background: rgba(30, 41, 59, 0.65);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.2);
}

.liquid-capsule-btn:hover {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 1),
    0 6px 20px rgba(15, 23, 42, 0.09);
}

.dark .liquid-capsule-btn:hover {
  background: rgba(51, 65, 85, 0.75);
}

/* 下拉菜单面板 */
.liquid-dropdown-menu {
  background: rgba(255, 255, 255, 0.85);
  border: 1.5px solid rgba(255, 255, 255, 0.95);
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 1),
    0 20px 50px rgba(15, 23, 42, 0.15);
}

.dark .liquid-dropdown-menu {
  background: rgba(15, 23, 42, 0.88);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.liquid-account-row {
  border: 1px solid transparent;
}

.liquid-account-row:hover {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.85);
}

.dark .liquid-account-row:hover {
  background: rgba(30, 41, 59, 0.7);
}

.liquid-account-row-active {
  background: color-mix(in srgb, var(--theme-primary) 12%, rgba(255, 255, 255, 0.8)) !important;
  border-color: color-mix(in srgb, var(--theme-primary) 35%, transparent) !important;
}

.liquid-btn-action {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.dark .liquid-btn-action {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.liquid-btn-action:hover {
  background: rgba(255, 255, 255, 0.85);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
}
</style>
