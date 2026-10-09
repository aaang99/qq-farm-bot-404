<script setup lang="ts">
import type { Card, UserCard } from '@/stores/user'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import api from '@/api'
import AdminSystemPanel from '@/components/admin/AdminSystemPanel.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import DeviceProtocolCard from '@/components/settings/DeviceProtocolCard.vue'
import { useUserSettings } from '@/composables/settings/useUserSettings'
import { useAdminSystemConfig } from '@/composables/useAdminSystemConfig'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { useToastStore } from '@/stores/toast'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const toast = useToastStore()

const rawSavedTab = localStorage.getItem('admin-active-tab')
const activeTab = ref<'card' | 'user' | 'system'>(
  (rawSavedTab === 'user' || rawSavedTab === 'system') ? rawSavedTab : 'card',
)

watch(activeTab, (newTab) => {
  localStorage.setItem('admin-active-tab', newTab)
})

const tabs = computed(() => [
  { key: 'card', label: '卡密', icon: 'i-carbon-ticket' },
  { key: 'user', label: '用户', icon: 'i-carbon-user-admin' },
  { key: 'system', label: '系统配置', icon: 'i-carbon-settings-services' },
] as const)

const modalVisible = ref(false)
const modalConfig = ref({
  title: '',
  message: '',
  type: 'primary' as 'primary' | 'danger',
  isAlert: true,
})

function showAlert(message: string, type: 'primary' | 'danger' = 'primary') {
  modalConfig.value = {
    title: type === 'danger' ? '错误' : '提示',
    message,
    type,
    isAlert: true,
  }
  modalVisible.value = true
}

// ========== 卡密管理 ==========
const cards = ref<Card[]>([])
const cardsLoading = ref(false)
const showCreateModal = ref(false)
const showExportMenu = ref(false)

const newCard = ref({
  description: '',
  days: 30,
  count: 1,
  type: 'time' as 'time' | 'quota',
})

const selectedCards = ref<Set<string>>(new Set())
const selectAll = ref(false)

const searchQuery = ref('')
const filterStatus = ref<'all' | 'used' | 'unused' | 'enabled' | 'disabled'>('all')
const cardTypeFilter = ref<'all' | 'time' | 'quota'>('all')

// 卡密领取功能
const cardClaimEnabled = ref(false)
const cardClaimLoading = ref(false)

const unusedTimeCardsCount = computed(() => {
  return cards.value.filter(c => c.type === 'time' && !c.usedBy && c.enabled).length
})

const filteredCards = computed(() => {
  let result = cards.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(card =>
      card.code.toLowerCase().includes(query)
      || card.description.toLowerCase().includes(query)
      || (card.usedBy && card.usedBy.toLowerCase().includes(query)),
    )
  }

  switch (filterStatus.value) {
    case 'used':
      result = result.filter(card => card.usedBy)
      break
    case 'unused':
      result = result.filter(card => !card.usedBy)
      break
    case 'enabled':
      result = result.filter(card => card.enabled)
      break
    case 'disabled':
      result = result.filter(card => !card.enabled)
      break
  }

  if (cardTypeFilter.value !== 'all') {
    result = result.filter(card => card.type === cardTypeFilter.value)
  }

  return result
})

async function fetchCards() {
  cardsLoading.value = true
  try {
    const result = await userStore.getAllCards()
    if (result.ok) {
      cards.value = result.data
    }
    else {
      toast.error(result.error || '获取卡密列表失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '获取卡密列表失败')
  }
  finally {
    cardsLoading.value = false
  }
}

async function fetchCardClaimStatus() {
  cardClaimLoading.value = true
  try {
    const res = await api.get('/api/card-claim/status')
    if (res.data.ok) {
      cardClaimEnabled.value = res.data.enabled
    }
  }
  catch (e: any) {
    console.error('获取卡密领取状态失败', e)
  }
  finally {
    cardClaimLoading.value = false
  }
}

async function toggleCardClaimStatus(enabled: boolean | undefined) {
  if (enabled === undefined)
    return
  cardClaimLoading.value = true
  try {
    const res = await api.post('/api/admin/card-claim/status', { enabled })
    if (res.data.ok) {
      cardClaimEnabled.value = res.data.enabled
      toast.success(enabled ? '卡密领取功能已开启' : '卡密领取功能已关闭')
    }
  }
  catch (e: any) {
    toast.error(e.message || '操作失败')
    cardClaimEnabled.value = !enabled
  }
  finally {
    cardClaimLoading.value = false
  }
}

async function createCard() {
  if (!newCard.value.description) {
    toast.warning('请输入卡密描述')
    return
  }

  const count = Math.min(Math.max(Number.parseInt(String(newCard.value.count), 10) || 1, 1), 100)

  try {
    const result = await userStore.createCard(
      newCard.value.description,
      newCard.value.days,
      count > 1 ? count : undefined,
      newCard.value.type,
    )
    if (result && result.ok) {
      if (result.batch) {
        toast.success(`成功创建 ${result.count} 个卡密`)
        try {
          exportCardsToFile(result.data, `卡密批量导出_${newCard.value.description}_${formatDateForFile(Date.now())}.txt`)
        } catch {}
      }
      else {
        toast.success('卡密创建成功')
      }
      showCreateModal.value = false
      newCard.value = { description: '', days: 30, count: 1, type: 'time' }
      // 延迟 300ms 刷新列表，确保后端文件写入完毕并防网络竞态
      setTimeout(() => {
        fetchCards()
      }, 300)
    }
    else {
      toast.error(result?.error || '创建卡密失败')
    }
  }
  catch (e: any) {
    // 捕获可能已成功写入但前端网络抖动的情况，自动静默刷新一次卡密列表
    setTimeout(() => { fetchCards() }, 500)
  }
}

async function toggleCardStatus(card: Card) {
  try {
    const result = await userStore.updateCard(card.code, { enabled: !card.enabled })
    if (result.ok) {
      toast.success(card.enabled ? '卡密已禁用' : '卡密已启用')
      await fetchCards()
    }
    else {
      toast.error(result.error || '操作失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '操作失败')
  }
}

async function deleteCard(card: Card) {
  if (!confirm(`确定要删除卡密 ${card.code} 吗？`))
    return

  try {
    const result = await userStore.deleteCard(card.code)
    if (result.ok) {
      toast.success('卡密删除成功')
      await fetchCards()
    }
    else {
      toast.error(result.error || '删除卡密失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '删除卡密失败')
  }
}

async function deleteSelectedCards() {
  const selectedCodes = Array.from(selectedCards.value)
  if (selectedCodes.length === 0) {
    toast.warning('请先选择要删除的卡密')
    return
  }

  if (!confirm(`确定要删除选中的 ${selectedCodes.length} 个卡密吗？此操作不可恢复！`))
    return

  try {
    const result = await userStore.deleteCardsBatch(selectedCodes)
    if (result.ok) {
      toast.success(`成功删除 ${result.deletedCount} 个卡密`)
      if (result.notFoundCount > 0) {
        toast.warning(`${result.notFoundCount} 个卡密未找到`)
      }
      selectedCards.value.clear()
      selectAll.value = false
      await fetchCards()
    }
    else {
      toast.error(result.error || '批量删除卡密失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '批量删除卡密失败')
  }
}

async function copyCode(code: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code)
      toast.success('卡密已复制到剪贴板')
    }
    else {
      const textArea = document.createElement('textarea')
      textArea.value = code
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      toast.success('卡密已复制到剪贴板')
      document.body.removeChild(textArea)
    }
  }
  catch (e) {
    toast.error('复制失败，请手动复制')
    console.error('复制失败:', e)
  }
}

async function copySelectedCards() {
  const codes = Array.from(selectedCards.value)
  if (codes.length === 0)
    return

  try {
    const text = codes.join('\n')
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      toast.success(`已复制 ${codes.length} 个卡密到剪贴板`)
    }
    else {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      toast.success(`已复制 ${codes.length} 个卡密到剪贴板`)
      document.body.removeChild(textArea)
    }
  }
  catch (e) {
    toast.error('复制失败，请手动复制')
    console.error('复制失败:', e)
  }
}

function formatDate(timestamp: number | null) {
  if (!timestamp)
    return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function formatDateForFile(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
}

function getCardTypeLabel(card: Card) {
  if (card.type === 'quota') {
    return '额度'
  }
  return '时间'
}

function getCardValueLabel(card: Card) {
  if (card.type === 'quota') {
    return `+${card.days}额度`
  }
  if (card.days === -1)
    return '永久'
  return `${card.days}天`
}

function exportCardsToFile(cardsToExport: Card[], filename?: string) {
  if (!cardsToExport || cardsToExport.length === 0) {
    toast.warning('没有可导出的卡密')
    return
  }

  const content = cardsToExport.map(card => [
    `兑换码: ${card.code}`,
    `类型: ${getCardTypeLabel(card)}`,
    `数量: ${getCardValueLabel(card)}`,
  ].join('\n')).join('\n\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `卡密导出_${formatDateForFile(Date.now())}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success(`已导出 ${cardsToExport.length} 个卡密到文件`)
}

function exportCardsAsCsv(cardsToExport: Card[], filename?: string) {
  if (!cardsToExport || cardsToExport.length === 0) {
    toast.warning('没有可导出的卡密')
    return
  }

  // BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF'
  const header = ['兑换码', '类型', '数量']
  const rows = cardsToExport.map(card => [
    card.code,
    getCardTypeLabel(card),
    getCardValueLabel(card),
  ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))

  const content = BOM + [header.join(','), ...rows].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `卡密导出_${formatDateForFile(Date.now())}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success(`已导出 ${cardsToExport.length} 个卡密到 CSV 文件`)
}

function handleExportCards(scope: 'all' | 'filtered' | 'selected', format: 'txt' | 'csv') {
  showExportMenu.value = false

  let cardsToExport: Card[]
  let label: string

  switch (scope) {
    case 'selected': {
      const codes = Array.from(selectedCards.value)
      cardsToExport = cards.value.filter(c => codes.includes(c.code))
      label = '已选'
      break
    }
    case 'filtered':
      cardsToExport = filteredCards.value
      label = '筛选'
      break
    case 'all':
    default:
      cardsToExport = cards.value
      label = '全部'
      break
  }

  if (cardsToExport.length === 0) {
    toast.warning('没有可导出的卡密')
    return
  }

  const dateStr = formatDateForFile(Date.now())
  if (format === 'csv') {
    exportCardsAsCsv(cardsToExport, `卡密${label}导出_${dateStr}.csv`)
  } else {
    exportCardsToFile(cardsToExport, `卡密${label}导出_${dateStr}.txt`)
  }
}

// Close export menu when clicking outside
function closeExportMenu(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.export-dropdown')) {
    showExportMenu.value = false
  }
}

function toggleSelectAll() {
  if (selectAll.value) {
    filteredCards.value.forEach(card => selectedCards.value.add(card.code))
  }
  else {
    filteredCards.value.forEach(card => selectedCards.value.delete(card.code))
  }
}

function toggleSelectCard(code: string) {
  if (selectedCards.value.has(code)) {
    selectedCards.value.delete(code)
    selectAll.value = false
  }
  else {
    selectedCards.value.add(code)
    if (filteredCards.value.every(card => selectedCards.value.has(card.code))) {
      selectAll.value = true
    }
  }
}

// ========== 用户管理 ==========
interface UserInfo {
  username: string
  role: string
  card: UserCard | null
  accountLimit: number
}

interface EditForm {
  newUsername: string
  password: string
  accountLimit: number
  expiresAt: string
  isPermanent: boolean
}

const users = ref<UserInfo[]>([])
const usersLoading = ref(false)
const userSearchQuery = ref('')

const filteredUsers = computed(() => {
  if (!userSearchQuery.value)
    return users.value
  const query = userSearchQuery.value.toLowerCase()
  return users.value.filter(user =>
    user.username.toLowerCase().includes(query),
  )
})
const showEditModal = ref(false)
const selectedUser = ref<UserInfo | null>(null)
const editForm = ref<EditForm>({
  newUsername: '',
  password: '',
  accountLimit: 2,
  expiresAt: '',
  isPermanent: false,
})
const editLoading = ref(false)

const currentUsername = computed(() => userStore.username)

async function fetchUsers() {
  usersLoading.value = true
  try {
    const result = await userStore.getAllUsers()
    if (result.ok) {
      users.value = result.data
    }
    else {
      toast.error(result.error || '获取用户列表失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '获取用户列表失败')
  }
  finally {
    usersLoading.value = false
  }
}

async function toggleUserStatus(user: UserInfo) {
  try {
    const updates: Partial<UserCard> = { enabled: !user.card?.enabled }
    const result = await userStore.updateUser(user.username, updates)
    if (result.ok) {
      toast.success(user.card?.enabled ? '用户已封禁' : '用户已解封')
      await fetchUsers()
    }
    else {
      toast.error(result.error || '操作失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '操作失败')
  }
}

async function deleteUser(user: UserInfo) {
  if (!confirm(`确定要删除用户 ${user.username} 吗？此操作不可恢复！`))
    return

  try {
    const result = await userStore.deleteUser(user.username)
    if (result.ok) {
      toast.success('用户删除成功')
      await fetchUsers()
    }
    else {
      toast.error(result.error || '删除用户失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '删除用户失败')
  }
}

const showClearExpiredConfirm = ref(false)
const clearExpiredLoading = ref(false)

async function clearExpiredUsers() {
  clearExpiredLoading.value = true
  try {
    const result = await userStore.clearExpiredUsers()
    if (result.ok) {
      toast.success(`成功清理 ${result.deletedCount} 个到期用户`)
      showClearExpiredConfirm.value = false
      await fetchUsers()
    }
    else {
      toast.error(result.error || '清理失败')
    }
  }
  catch (e: any) {
    toast.error(e.message || '清理失败')
  }
  finally {
    clearExpiredLoading.value = false
  }
}

function openEditModal(user: UserInfo) {
  selectedUser.value = user
  editForm.value = {
    newUsername: user.username,
    password: '',
    accountLimit: user.accountLimit || 2,
    expiresAt: user.card?.expiresAt ? formatDateTimeLocal(user.card.expiresAt) : '',
    isPermanent: user.card?.days === -1,
  }
  showEditModal.value = true
}

function formatDateTimeLocal(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

async function handleEdit() {
  if (!selectedUser.value)
    return

  editLoading.value = true
  try {
    const expiresAtValue = editForm.value.isPermanent
      ? null
      : (editForm.value.expiresAt ? new Date(editForm.value.expiresAt).getTime() : null)

    const updateData: Record<string, any> = {
      accountLimit: editForm.value.accountLimit,
      expiresAt: expiresAtValue,
      isPermanent: editForm.value.isPermanent,
    }

    if (editForm.value.newUsername && editForm.value.newUsername !== selectedUser.value.username) {
      updateData.newUsername = editForm.value.newUsername
    }

    if (editForm.value.password) {
      updateData.password = editForm.value.password
    }

    const res = await api.post(`/api/admin/users/${selectedUser.value.username}/edit`, updateData)

    if (res.data.ok) {
      toast.success('用户信息已更新')
      showEditModal.value = false
      await fetchUsers()
    }
    else {
      toast.error(res.data.error || '更新失败')
    }
  }
  catch (e: any) {
    toast.error(e?.response?.data?.error || e?.message || '更新失败')
  }
  finally {
    editLoading.value = false
  }
}

function getDaysLabel(days: number) {
  if (days === -1)
    return '永久'
  return `${days}天`
}

function isExpired(card: UserCard | null) {
  if (!card?.expiresAt)
    return false
  return Date.now() > card.expiresAt
}

// ========== 原生系统配置 ==========
const {
  systemConfigSaving,
  captureConfigSaving,
  captureConfigTesting,
  localSystemConfig,
  defaultSystemConfig,
  localCaptureConfig,
  platformOptions,
  osOptions,
  loadCaptureConfig,
  handleTestCaptureConfig,
  loadSystemConfig,
  handleResetSystemConfig,
} = useAdminSystemConfig({ showAlert })

const {
  deviceProtocolLoading,
  deviceProtocolSaving,
  deviceProtocolPresetOptions,
  selectedDevicePreset,
  deviceProtocolForm,
  fillRandomDeviceMac,
  fillRandomDeviceId,
  fillRandomImei,
  applyDevicePreset,
  fetchDeviceProtocol,
} = useUserSettings(showAlert)

const systemSettingsSaving = ref(false)
const anySystemSaving = computed(() => systemSettingsSaving.value || systemConfigSaving.value || captureConfigSaving.value || deviceProtocolSaving.value)

async function saveSystemSettings() {
  if (anySystemSaving.value)
    return
  systemSettingsSaving.value = true
  try {
    const devicePayload = {
      enabled: !!deviceProtocolForm.value.enabled,
      userAgent: String(deviceProtocolForm.value.userAgent || '').trim(),
      deviceBrand: String(deviceProtocolForm.value.deviceBrand || '').trim(),
      deviceModel: String(deviceProtocolForm.value.deviceModel || '').trim(),
      deviceMac: String(deviceProtocolForm.value.deviceMac || '').trim(),
      deviceId: String(deviceProtocolForm.value.deviceId || '').trim(),
      imei: String(deviceProtocolForm.value.imei || '').trim(),
    }
    const [systemResult, captureResult, deviceResult] = await Promise.all([
      api.post('/api/admin/system-config', { ...localSystemConfig.value, confirmed: true }),
      api.post('/api/admin/capture-config', { ...localCaptureConfig.value, confirmed: true }),
      api.post('/api/user/device-protocol', devicePayload),
    ])
    if (!systemResult.data?.ok || !captureResult.data?.ok || !deviceResult.data?.ok)
      throw new Error('部分系统配置保存失败')
    await Promise.all([loadSystemConfig(), loadCaptureConfig(), fetchDeviceProtocol()])
    showAlert('系统配置已统一保存并生效')
  }
  catch (error: any) {
    showAlert(error.response?.data?.error || error.message || '系统配置保存失败', 'danger')
  }
  finally {
    systemSettingsSaving.value = false
  }
}

watch(activeTab, (newTab) => {
  if (newTab === 'card') fetchCards()
  else if (newTab === 'user') fetchUsers()
})

onMounted(async () => {
  document.addEventListener('click', closeExportMenu)
  if (activeTab.value === 'card') await fetchCards()
  else if (activeTab.value === 'user') await fetchUsers()
  fetchCardClaimStatus()
  await Promise.all([loadSystemConfig(), loadCaptureConfig(), fetchDeviceProtocol()])
})

onUnmounted(() => {
  document.removeEventListener('click', closeExportMenu)
})
</script>

<template>
  <div class="admin-panel w-full space-y-3 sm:space-y-4">
    <!-- 标题 + Tab 液态玻璃通栏面板 -->
    <div class="ui-card-elevated relative overflow-hidden rounded-2xl p-4 sm:p-5 shadow-sm transition-all">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-gray-100/70 pb-3 dark:border-gray-800/70">
        <div class="flex items-center gap-2.5">
          <div class="h-9 w-9 flex shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 font-bold text-base shadow-sm ring-1 ring-white/80">
            <div class="i-carbon-security text-xl" />
          </div>
          <div>
            <h1 class="text-base font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              后台管理系统
            </h1>
            <p class="text-xs text-gray-400 mt-0.5">卡密分发、用户额度与底层网关配置</p>
          </div>
        </div>
      </div>

      <nav class="flex gap-2 p-1 rounded-xl bg-gray-100/60 dark:bg-gray-800/50 backdrop-blur-md mb-4">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all duration-200"
          :class="activeTab === tab.key
            ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="activeTab = tab.key"
        >
          <div :class="tab.icon" class="text-sm sm:text-base" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <!-- 一体化内容区（无断开，共享顶部毛玻璃卡片） -->
      <div class="w-full border-t border-gray-100/70 pt-4 dark:border-gray-800/70">
        <!-- 卡密管理 -->
        <div v-if="activeTab === 'card'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg text-gray-800 font-semibold dark:text-gray-200">
              卡密管理
            </h3>
            <div class="flex items-center gap-2">
              <BaseButton variant="secondary" size="sm" @click="fetchCards">
                刷新
              </BaseButton>
              <!-- 导出按钮 -->
              <div class="export-dropdown relative">
                <BaseButton variant="secondary" size="sm" @click="showExportMenu = !showExportMenu">
                  <span class="flex items-center gap-1">
                    <span class="i-carbon-download text-sm" />
                    导出
                  </span>
                </BaseButton>
                <div
                  v-if="showExportMenu"
                  class="absolute right-0 z-50 mt-1 min-w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700"
                  @click.stop
                >
                  <div class="px-3 py-1.5 text-xs text-gray-400 font-medium dark:text-gray-500">
                    导出范围
                  </div>
                  <button
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                    @click="handleExportCards('all', 'txt')"
                  >
                    <span class="i-carbon-document text-sm" />
                    全部卡密 (.txt)
                  </button>
                  <button
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                    @click="handleExportCards('all', 'csv')"
                  >
                    <span class="i-carbon-document text-sm" />
                    全部卡密 (.csv)
                  </button>
                  <div class="my-1 border-t border-gray-100 dark:border-gray-600" />
                  <button
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                    @click="handleExportCards('filtered', 'txt')"
                  >
                    <span class="i-carbon-filter text-sm" />
                    当前筛选 (.txt)
                  </button>
                  <button
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                    @click="handleExportCards('filtered', 'csv')"
                  >
                    <span class="i-carbon-filter text-sm" />
                    当前筛选 (.csv)
                  </button>
                  <template v-if="selectedCards.size > 0">
                    <div class="my-1 border-t border-gray-100 dark:border-gray-600" />
                    <button
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-green-700 hover:bg-gray-100 dark:text-green-300 dark:hover:bg-gray-600"
                      @click="handleExportCards('selected', 'txt')"
                    >
                      <span class="i-carbon-checkmark-outline text-sm" />
                      已选 {{ selectedCards.size }} 个 (.txt)
                    </button>
                    <button
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-green-700 hover:bg-gray-100 dark:text-green-300 dark:hover:bg-gray-600"
                      @click="handleExportCards('selected', 'csv')"
                    >
                      <span class="i-carbon-checkmark-outline text-sm" />
                      已选 {{ selectedCards.size }} 个 (.csv)
                    </button>
                  </template>
                </div>
              </div>
              <BaseButton variant="primary" size="sm" @click="showCreateModal = true">
                创建卡密
              </BaseButton>
            </div>
          </div>

          <!-- 卡密领取功能开关 -->
          <div class="flex items-center justify-between border border-gray-200 rounded-lg bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div>
              <h4 class="text-sm text-gray-900 font-medium dark:text-white">
                卡密领取功能
              </h4>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                开启后，用户注册时可免费领取一张时间卡密
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-500">
                库存: <span class="font-medium" :class="unusedTimeCardsCount > 0 ? 'text-green-600' : 'text-red-600'">{{ unusedTimeCardsCount }}</span> 张
              </span>
              <BaseSwitch
                v-model="cardClaimEnabled"
                :disabled="cardClaimLoading"
                @update:model-value="toggleCardClaimStatus"
              />
            </div>
          </div>

          <div class="flex gap-2">
            <button
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              :class="cardTypeFilter === 'all'
                ? 'text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
              :style="cardTypeFilter === 'all' ? { backgroundColor: 'var(--theme-primary)' } : {}"
              @click="cardTypeFilter = 'all'"
            >
              全部
            </button>
            <button
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              :class="cardTypeFilter === 'time'
                ? 'text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
              :style="cardTypeFilter === 'time' ? { backgroundColor: 'var(--theme-primary)' } : {}"
              @click="cardTypeFilter = 'time'"
            >
              时间卡密
            </button>
            <button
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              :class="cardTypeFilter === 'quota'
                ? 'text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
              :style="cardTypeFilter === 'quota' ? { backgroundColor: 'var(--theme-primary)' } : {}"
              @click="cardTypeFilter = 'quota'"
            >
              配额卡密
            </button>
          </div>

          <div class="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow dark:bg-gray-800">
            <input
              v-model="searchQuery"
              placeholder="搜索卡密、描述或使用者..."
              class="h-8 w-64 border border-gray-300 rounded-lg bg-white px-3 text-sm text-gray-900 outline-none transition-all dark:border-gray-600 focus:border-green-500 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500/20"
            >
            <select
              v-model="filterStatus"
              class="h-8 border border-gray-300 rounded-lg bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">
                全部状态
              </option>
              <option value="unused">
                未使用
              </option>
              <option value="used">
                已使用
              </option>
              <option value="enabled">
                已启用
              </option>
              <option value="disabled">
                已禁用
              </option>
            </select>
          </div>

          <div v-if="selectedCards.size > 0" class="flex items-center gap-3 rounded-lg p-3" style="background-color: rgba(var(--theme-primary-rgb, 59, 130, 246), 0.1);">
            <span style="color: var(--theme-primary);">
              已选择 {{ selectedCards.size }} 个卡密            </span>
            <BaseButton variant="secondary" size="sm" @click="copySelectedCards">
              一键复制
            </BaseButton>
            <BaseButton variant="danger" size="sm" @click="deleteSelectedCards">
              批量删除
            </BaseButton>
            <button
              class="ml-auto text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700"
              @click="selectedCards.clear(); selectAll = false"
            >
              清除选择
            </button>
          </div>

          <div v-if="cardsLoading" class="py-8 text-center text-gray-500">
            <div i-svg-spinners-90-ring-with-bg class="mb-2 inline-block text-2xl" />
            <div>加载中...</div>
          </div>

          <div v-else class="overflow-hidden rounded-xl border border-gray-100/80 bg-white/40 backdrop-blur-sm dark:border-gray-800/80 dark:bg-gray-800/30">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th class="px-3 py-2 text-left">
                      <input
                        v-model="selectAll"
                        type="checkbox"
                        class="border-gray-300 rounded"
                        @change="toggleSelectAll"
                      >
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      卡密
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      描述
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      类型
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      数量
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      状态
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      使用者
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      生成时间
                    </th>
                    <th class="px-4 py-2 text-left text-xs text-gray-500 font-medium dark:text-gray-300">
                      使用时间
                    </th>
                    <th class="px-4 py-2 text-right text-xs text-gray-500 font-medium dark:text-gray-300">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr v-for="card in filteredCards" :key="card.code" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-3 py-2">
                      <input
                        :checked="selectedCards.has(card.code)"
                        type="checkbox"
                        class="border-gray-300 rounded"
                        @change="toggleSelectCard(card.code)"
                      >
                    </td>
                    <td class="whitespace-nowrap px-4 py-2">
                      <code class="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">{{ card.code }}</code>
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-900 dark:text-white">
                      {{ card.description }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2">
                      <span
                        class="inline-flex rounded-full px-2 py-0.5 text-xs"
                        :class="card.type === 'quota' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'"
                      >
                        {{ getCardTypeLabel(card) }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-900 dark:text-white">
                      {{ getCardValueLabel(card) }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2">
                      <span
                        class="inline-flex rounded-full px-2 py-0.5 text-xs"
                        :class="card.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'"
                      >
                        {{ card.enabled ? '启用' : '禁用' }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {{ card.usedBy || '-' }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {{ card.createdAt ? new Date(card.createdAt).toLocaleString() : '-' }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {{ card.usedAt ? new Date(card.usedAt).toLocaleString() : '-' }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-right text-sm">
                      <button class="mr-2 hover:opacity-80" style="color: var(--theme-primary);" @click="copyCode(card.code)">
                        复制
                      </button>
                      <button class="mr-2 hover:opacity-80" style="color: var(--theme-primary);" @click="toggleCardStatus(card)">
                        {{ card.enabled ? '禁用' : '启用' }}
                      </button>
                      <button class="text-red-600 dark:text-red-400 hover:text-red-900" @click="deleteCard(card)">
                        删除
                      </button>
                    </td>
                  </tr>
                  <tr v-if="filteredCards.length === 0">
                    <td colspan="10" class="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                      暂无卡密
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            v-if="showCreateModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            @click.self="showCreateModal = false"
          >
            <div class="max-w-md w-[95vw] rounded-lg bg-white p-5 dark:bg-gray-800 sm:w-full" @click.stop>
              <h2 class="mb-4 text-lg text-gray-900 font-bold dark:text-white">
                创建卡密
              </h2>
              <div class="space-y-3">
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    描述
                  </label>
                  <BaseInput
                    v-model="newCard.description"
                    placeholder="例如：月卡2024"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    卡密类型
                  </label>
                  <div class="flex gap-4">
                    <label class="flex cursor-pointer items-center gap-2">
                      <input
                        v-model="newCard.type"
                        type="radio"
                        value="time"
                        class="text-blue-600 focus:ring-blue-500"
                      >
                      <span class="text-sm text-gray-700 dark:text-gray-300">时间卡（增加使用时长）</span>
                      <label class="flex cursor-pointer items-center gap-2">
                        <input
                          v-model="newCard.type"
                          type="radio"
                          value="quota"
                          class="text-orange-600 focus:ring-orange-500"
                        >
                        <span class="text-sm text-gray-700 dark:text-gray-300">额度卡（增加账号额度）</span>
                      </label></label>
                  </div>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    {{ newCard.type === 'quota' ? '额度数量' : '天数' }}
                  </label>
                  <BaseInput
                    v-model.number="newCard.days"
                    type="number"
                    :placeholder="newCard.type === 'quota' ? '可添加的账号数量' : '天数'"
                  />
                  <p v-if="newCard.type === 'time'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    输入-1表示永久，其他数字表示天数
                  </p>
                  <p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    用户使用后可增加的账号额度数量
                  </p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    数量
                  </label>
                  <BaseInput
                    v-model.number="newCard.count"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="数量"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    批量创建数量（1-100），批量创建后会自动导出文件
                  </p>
                </div>
              </div>
              <div class="mt-5 flex justify-end space-x-3">
                <BaseButton variant="secondary" size="sm" @click="showCreateModal = false">
                  取消
                </BaseButton>
                <BaseButton variant="primary" size="sm" @click="createCard">
                  创建
                </BaseButton>
              </div>
            </div>
          </div>
        </div>

        <!-- 用户管理 -->
        <div v-else-if="activeTab === 'user'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg text-gray-900 font-bold dark:text-gray-100">
              用户管理
            </h3>
            <div class="flex items-center gap-2">
              <BaseButton variant="danger" size="sm" @click="showClearExpiredConfirm = true">
                清理到期用户
              </BaseButton>
              <BaseButton variant="primary" size="sm" @click="fetchUsers">
                刷新
              </BaseButton>
            </div>
          </div>

          <div class="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow dark:bg-gray-800">
            <input
              v-model="userSearchQuery"
              placeholder="搜索用户..."
              class="h-8 w-64 border border-gray-300 rounded-lg bg-white px-3 text-sm text-gray-900 outline-none transition-all dark:border-gray-600 focus:border-green-500 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500/20"
            >
          </div>

          <div v-if="usersLoading" class="py-8 text-center text-gray-500">
            <div i-svg-spinners-90-ring-with-bg class="mb-2 inline-block text-2xl" />
            <div>加载中...</div>
          </div>

          <div v-else class="overflow-hidden rounded-xl border border-gray-100/80 bg-white/40 backdrop-blur-sm dark:border-gray-800/80 dark:bg-gray-800/30">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs text-gray-500 font-medium uppercase dark:text-gray-300">
                      用户名
                    </th>
                    <th class="px-3 py-2 text-left text-xs text-gray-500 font-medium uppercase dark:text-gray-300">
                      角色
                    </th>
                    <th class="px-3 py-2 text-left text-xs text-gray-500 font-medium uppercase dark:text-gray-300">
                      额度
                    </th>
                    <th class="px-3 py-2 text-left text-xs text-gray-500 font-medium uppercase dark:text-gray-300">
                      时长
                    </th>
                    <th class="px-3 py-2 text-left text-xs text-gray-500 font-medium uppercase dark:text-gray-300">
                      过期时间
                    </th>
                    <th class="px-3 py-2 text-left text-xs text-gray-500 font-medium uppercase dark:text-gray-300">
                      状态
                    </th>
                    <th class="px-3 py-2 text-right text-xs text-gray-500 font-medium uppercase dark:text-gray-300">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  <tr v-for="user in filteredUsers" :key="user.username">
                    <td class="whitespace-nowrap px-3 py-2 text-sm text-gray-900 font-medium dark:text-white">
                      {{ user.username }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-white">
                      <span
                        class="inline-flex rounded-full px-2 text-xs font-semibold leading-5"
                        :class="user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'"
                      >
                        {{ user.role === 'admin' ? '管理员' : '用户' }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-white">
                      <span
                        class="inline-flex rounded-full px-2 text-xs font-semibold leading-5"
                        :class="user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'"
                      >
                        {{ user.role === 'admin' ? '无限制' : `${String(user.accountLimit || 2)}个` }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {{ user.card ? getDaysLabel(user.card.days) : '-' }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-sm" :class="isExpired(user.card) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">
                      {{ formatDate(user.card?.expiresAt || null) }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2">
                      <span
                        v-if="user.card"
                        class="inline-flex rounded-full px-2 text-xs font-semibold leading-5"
                        :class="user.card.enabled === false ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : (isExpired(user.card) ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200')"
                      >
                        {{ user.card.enabled === false ? '封禁' : (isExpired(user.card) ? '已过期' : '正常') }}
                      </span>
                      <span v-else class="text-gray-500 dark:text-gray-400">-</span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-right text-sm font-medium">
                      <button
                        class="mr-3 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        @click="openEditModal(user)"
                      >
                        编辑
                      </button>
                      <button
                        v-if="user.card"
                        class="mr-3 text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
                        @click="toggleUserStatus(user)"
                      >
                        {{ user.card.enabled === false ? '解封' : '封禁' }}
                      </button>
                      <button
                        v-if="user.username !== currentUsername"
                        class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        @click="deleteUser(user)"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                  <tr v-if="filteredUsers.length === 0">
                    <td colspan="8" class="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                      {{ userSearchQuery ? '未找到匹配的用户' : '暂无用户' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            v-if="showEditModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            @click.self="showEditModal = false"
          >
            <div class="max-w-md w-[95vw] rounded-lg bg-white p-5 dark:bg-gray-800 sm:w-full" @click.stop>
              <h2 class="mb-4 text-lg text-gray-900 font-bold dark:text-white">
                编辑用户：{{ selectedUser?.username }}
              </h2>
              <div class="space-y-3">
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    用户名
                  </label>
                  <BaseInput
                    v-model="editForm.newUsername"
                    placeholder="输入新用户名（留空则不修改）"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    用户名只能包含字母、数字和下划线，长度3-32位
                  </p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    新密码
                  </label>
                  <BaseInput
                    v-model="editForm.password"
                    type="password"
                    placeholder="输入新密码（留空则不修改）"
                  />
                  <p class="dark:text-gray-400" mt-1 text-xs text-gray-500>
                    密码长度至少6位，需包含大写字母、小写字母、数字、特殊符号中的至少两种
                  </p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    账号额度
                  </label>
                  <BaseInput
                    v-model.number="editForm.accountLimit"
                    type="number"
                    min="1"
                    placeholder="可添加的账号数量"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    用户最多可添加的农场账号数量
                  </p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-700 font-medium dark:text-gray-300">
                    过期时间
                  </label>
                  <div class="flex items-center gap-3">
                    <input
                      v-model="editForm.isPermanent"
                      type="checkbox"
                      class="border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                    >
                    <span class="text-sm text-gray-600 dark:text-gray-400">永久有效</span>
                  </div>
                  <input
                    v-if="!editForm.isPermanent"
                    v-model="editForm.expiresAt"
                    type="datetime-local"
                    class="mt-2 w-full border border-gray-200 rounded-lg bg-white px-3 py-2 text-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="mt-5 flex justify-end space-x-3">
                <BaseButton variant="secondary" size="sm" @click="showEditModal = false">
                  取消
                </BaseButton>
                <BaseButton
                  variant="primary"
                  size="sm"
                  :disabled="editLoading"
                  @click="handleEdit"
                >
                  {{ editLoading ? '保存中...' : '保存' }}
                </BaseButton>
              </div>
            </div>
          </div>

          <!-- 清理到期用户确认弹窗 -->
          <div
            v-if="showClearExpiredConfirm"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            @click.self="showClearExpiredConfirm = false"
          >
            <div class="max-w-md w-[95vw] rounded-lg bg-white p-5 dark:bg-gray-800 sm:w-full" @click.stop>
              <h2 class="mb-4 text-lg text-gray-900 font-bold dark:text-white">
                确认清理到期用户
              </h2>
              <p class="mb-4 text-gray-600 dark:text-gray-300">
                确定要清理所有到期的用户吗？此操作将删除所有已过期的普通用户账号，且不可恢复！
              </p>
              <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
                管理员账号不会被删除
              </p>
              <div class="flex justify-end space-x-3">
                <BaseButton variant="secondary" size="sm" @click="showClearExpiredConfirm = false">
                  取消
                </BaseButton>
                <BaseButton
                  variant="danger"
                  size="sm"
                  :loading="clearExpiredLoading"
                  @click="clearExpiredUsers"
                >
                  确认清理
                </BaseButton>
              </div>
            </div>
          </div>
        </div>

        <!-- 应用宝 YYB 服务管理中心 -->
        <div v-else-if="activeTab === 'system'" class="space-y-5">
          <div class="sticky top-0 z-10 flex items-center justify-between border border-gray-200 rounded-xl bg-white/95 p-4 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <div>
              <h3 class="text-lg text-gray-900 font-bold dark:text-gray-100">
                系统配置
              </h3>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                统一管理连接参数、设备协议和抓包服务。
              </p>
            </div>
            <BaseButton size="sm" :loading="anySystemSaving" @click="saveSystemSettings">
              保存系统配置
            </BaseButton>
          </div>

          <AdminSystemPanel
            v-model:local-system-config="localSystemConfig"
            v-model:local-capture-config="localCaptureConfig"
            section="system"
            :show-heading="false"
            :show-save="false"
            :default-system-config="defaultSystemConfig"
            :platform-options="platformOptions"
            :os-options="osOptions"
            :system-config-saving="systemConfigSaving"
            :capture-config-saving="captureConfigSaving"
            :capture-config-testing="captureConfigTesting"
            @reset-system="handleResetSystemConfig"
            @test-capture="handleTestCaptureConfig"
          />

          <DeviceProtocolCard
            v-model:form="deviceProtocolForm"
            v-model:selected-preset="selectedDevicePreset"
            :loading="deviceProtocolLoading"
            :saving="deviceProtocolSaving"
            :preset-options="deviceProtocolPresetOptions"
            :show-save="false"
            @apply-preset="applyDevicePreset"
            @random-mac="fillRandomDeviceMac"
            @random-device-id="fillRandomDeviceId"
            @random-imei="fillRandomImei"
          />

          <AdminSystemPanel
            v-model:local-system-config="localSystemConfig"
            v-model:local-capture-config="localCaptureConfig"
            section="capture"
            :show-heading="false"
            :show-save="false"
            :default-system-config="defaultSystemConfig"
            :platform-options="platformOptions"
            :os-options="osOptions"
            :system-config-saving="systemConfigSaving"
            :capture-config-saving="captureConfigSaving"
            :capture-config-testing="captureConfigTesting"
            @test-capture="handleTestCaptureConfig"
          />
        </div>
      </div>
    </div>

    <ConfirmModal
      :show="modalVisible"
      :title="modalConfig.title"
      :message="modalConfig.message"
      :type="modalConfig.type"
      :is-alert="modalConfig.isAlert"
      confirm-text="知道了"
      @confirm="modalVisible = false"
      @cancel="modalVisible = false"
    />
  </div>
</template>

<style scoped lang="postcss">
</style>
