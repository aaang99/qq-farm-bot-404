<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'

interface OfflineReminderConfig {
  channel: string
  recipientEmail?: string
  [key: string]: any
}

defineProps<{
  saving: boolean
  testing: boolean
  currentAccountName?: string | null
}>()

const emit = defineEmits<{
  test: []
  save: []
}>()

const config = defineModel<OfflineReminderConfig>('config', { required: true })

if (!config.value.channel) {
  config.value.channel = 'smtp'
}

const POPULAR_SUFFIXES = [
  '@qq.com',
  '@163.com',
  '@gmail.com',
  '@126.com',
  '@outlook.com',
  '@foxmail.com',
  'custom',
]

function parseEmail(fullEmail: string) {
  const str = String(fullEmail || '').trim()
  if (!str) return { prefix: '', suffix: '@qq.com', customSuffix: '', isCustom: false }
  
  const atIdx = str.lastIndexOf('@')
  if (atIdx === -1) {
    return { prefix: str, suffix: '@qq.com', customSuffix: '', isCustom: false }
  }
  
  const prefix = str.slice(0, atIdx)
  const suffix = str.slice(atIdx).toLowerCase()
  const matched = POPULAR_SUFFIXES.find(s => s === suffix)
  
  if (matched) {
    return { prefix, suffix: matched, customSuffix: '', isCustom: false }
  }
  return { prefix, suffix: 'custom', customSuffix: suffix, isCustom: true }
}

const initial = parseEmail(config.value.recipientEmail || '')
const rawPrefix = ref(initial.prefix)
const selectedSuffix = ref(initial.suffix)
const customSuffix = ref(initial.customSuffix || '')

// 核心优化：智能清洗 prefix。如果用户在输入框里完整粘贴或输入了 xxx@qq.com，自动识别并拆出纯前缀，自动选中对应后缀！
function cleanPrefixAndSyncSuffix(val: string) {
  const trimmed = val.trim()
  const atIdx = trimmed.lastIndexOf('@')
  if (atIdx !== -1) {
    const p = trimmed.slice(0, atIdx)
    const s = trimmed.slice(atIdx).toLowerCase()
    const matched = POPULAR_SUFFIXES.find(item => item === s)
    if (matched) {
      selectedSuffix.value = matched
      rawPrefix.value = p
      return
    } else {
      selectedSuffix.value = 'custom'
      customSuffix.value = s
      rawPrefix.value = p
      return
    }
  }
}

watch(rawPrefix, (val) => {
  cleanPrefixAndSyncSuffix(val)
})

// 组合完整邮箱
const fullEmailAddress = computed(() => {
  const p = rawPrefix.value.trim()
  if (!p) return ''
  if (selectedSuffix.value === 'custom') {
    const suf = customSuffix.value.trim()
    if (!suf) return p
    return suf.startsWith('@') ? `${p}${suf}` : `${p}@${suf}`
  }
  return `${p}${selectedSuffix.value}`
})

// 监听组合结果同步给 config.recipientEmail
watch(fullEmailAddress, (val) => {
  config.value.channel = 'smtp'
  config.value.recipientEmail = val
}, { immediate: true })

// 外部数据变化时同步内部输入框
watch(() => config.value.recipientEmail, (val) => {
  if (val !== fullEmailAddress.value) {
    const parsed = parseEmail(val || '')
    rawPrefix.value = parsed.prefix
    selectedSuffix.value = parsed.suffix
    if (parsed.customSuffix) customSuffix.value = parsed.customSuffix
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- 头部说明卡片 -->
    <div class="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300 border border-blue-100/60 dark:border-blue-900/40 flex items-start gap-2">
      <div class="i-carbon-information text-base shrink-0 mt-0.5" />
      <div class="leading-relaxed">
        掉线提醒由系统管理员统一发信。您只需填写接收邮箱，账号离线时系统将第一时间向您推送邮件通知。
      </div>
    </div>

    <!-- 邮箱输入两件套组合卡片 -->
    <div class="border border-gray-200/80 rounded-xl bg-white/70 p-4 dark:border-gray-700/80 dark:bg-gray-800/60 backdrop-blur-sm space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <div class="i-carbon-email text-sm text-blue-500" />
          <span>接收邮箱地址</span>
        </label>
        <span v-if="fullEmailAddress" class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
          接收邮箱: {{ fullEmailAddress }}
        </span>
      </div>

      <!-- 组合输入框：前缀 + 后缀选择下拉框 -->
      <div class="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 shadow-sm overflow-hidden focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors">
        <!-- 邮箱前缀（输入QQ号或邮箱用户名，直接粘贴完整邮箱亦可自动识别拆解） -->
        <input
          v-model="rawPrefix"
          type="text"
          class="flex-1 min-w-0 px-3.5 py-2.5 text-sm bg-transparent border-0 outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 font-mono"
          placeholder="请填写QQ号或邮箱前缀"
        />

        <div class="h-5 w-[1px] bg-gray-200 dark:bg-gray-700 shrink-0" />

        <!-- 后缀下拉选择框 -->
        <select
          v-model="selectedSuffix"
          class="shrink-0 px-3 py-2.5 text-sm bg-transparent border-0 outline-none text-gray-700 dark:text-gray-200 font-medium cursor-pointer"
        >
          <option value="@qq.com">@qq.com (默认)</option>
          <option value="@163.com">@163.com</option>
          <option value="@gmail.com">@gmail.com</option>
          <option value="@126.com">@126.com</option>
          <option value="@outlook.com">@outlook.com</option>
          <option value="@foxmail.com">@foxmail.com</option>
          <option value="custom">自定义后缀...</option>
        </select>
      </div>

      <!-- 选中自定义后缀时的额外输入行 -->
      <div v-if="selectedSuffix === 'custom'" class="flex items-center gap-2 pt-1 animate-fade-in">
        <span class="text-xs text-gray-500 shrink-0">自定义后缀:</span>
        <input
          v-model="customSuffix"
          type="text"
          placeholder="@example.com"
          class="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 font-mono"
        />
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div class="flex items-center justify-end gap-2.5 pt-1">
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="testing"
        :disabled="saving || !fullEmailAddress"
        @click="emit('test')"
      >
        <span class="i-carbon-send mr-1" />
        测试发送
      </BaseButton>

      <BaseButton
        variant="primary"
        size="sm"
        :loading="saving"
        :disabled="testing"
        @click="emit('save')"
      >
        <span class="i-carbon-checkmark mr-1" />
        保存接收设置
      </BaseButton>
    </div>
  </div>
</template>
