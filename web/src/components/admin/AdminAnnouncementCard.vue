<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

const loading = ref(false)
const saving = ref(false)

const form = ref({
  enabled: true,
  title: '系统公告',
  content: '',
  showOnce: true,
  updatedAt: 0,
})

async function fetchAnnouncement() {
  loading.value = true
  try {
    const res = await api.get('/api/announcement')
    if (res.data?.ok && res.data.data) {
      const d = res.data.data
      form.value.enabled = d.enabled !== false
      form.value.title = d.title || '系统公告'
      form.value.content = d.content || ''
      form.value.showOnce = d.showOnce !== false
      form.value.updatedAt = Number(d.updatedAt) || 0
    }
  } catch (err: any) {
    console.error('获取系统公告失败:', err)
  } finally {
    loading.value = false
  }
}

async function saveAnnouncement() {
  saving.value = true
  try {
    const res = await api.post('/api/admin/announcement', form.value)
    if (res.data?.ok) {
      toastStore.success('全站公告已成功发布并同步！')
      form.value.updatedAt = res.data.data?.updatedAt || Date.now()
    } else {
      toastStore.error(res.data?.error || '发布失败')
    }
  } catch (err: any) {
    toastStore.error(err.response?.data?.error || err.message || '发布失败')
  } finally {
    saving.value = false
  }
}

function clearContent() {
  form.value.content = ''
}

onMounted(() => {
  void fetchAnnouncement()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 卡片主体：iOS 液态磨砂设计 -->
    <div class="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-xl backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-800/90 sm:p-6">
      <div class="flex flex-col gap-4">
        <!-- 头部标题 + 主开关 -->
        <div class="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-700/60">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold dark:bg-amber-500/20">
              <div class="i-carbon-bullhorn text-xl" />
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                全站系统公告
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                向本站所有用户推送官方通知、活动通知与更新指引。
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold" :class="form.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'">
              {{ form.enabled ? '已开启展示' : '已暂停展示' }}
            </span>
            <BaseSwitch v-model="form.enabled" />
          </div>
        </div>

        <!-- 公告表单区域 -->
        <div class="space-y-4 pt-1">
          <!-- 公告标题 -->
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
              公告标题
            </label>
            <BaseInput
              v-model="form.title"
              placeholder="请输入公告标题，例如：欢迎来到 QQ 农场智能助手"
              maxlength="40"
            />
          </div>

          <!-- 公告正文 -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                公告正文内容 (支持换行与链接)
              </label>
              <button
                type="button"
                class="text-xs text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                @click="clearContent"
              >
                清空内容
              </button>
            </div>
            <textarea
              v-model="form.content"
              rows="6"
              class="w-full rounded-xl border border-gray-200 bg-white/70 p-3 text-xs leading-relaxed text-gray-800 placeholder-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100 sm:text-sm"
              placeholder="在此输入需要向全站用户公布的内容，支持分段换行..."
            />
          </div>

          <!-- 弹窗提醒策略 -->
          <div class="flex items-center justify-between rounded-xl bg-gray-50/80 p-3.5 border border-gray-100 dark:bg-gray-900/40 dark:border-gray-800">
            <div>
              <div class="text-xs font-bold text-gray-800 dark:text-gray-200">
                仅在内容更新后自动弹窗一次
              </div>
              <p class="text-[11px] text-gray-400 mt-0.5">
                开启后，每当站长发布新内容时，用户首次登录仅弹窗提醒 1 次，点击我知道后不再弹出（只保留右上角铃铛随时查看）。
              </p>
            </div>
            <BaseSwitch v-model="form.showOnce" />
          </div>

          <!-- 底部发布栏 -->
          <div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60">
            <span v-if="form.updatedAt" class="text-xs text-gray-400 font-mono">
              上次发布：{{ new Date(form.updatedAt).toLocaleString('zh-CN', { hour12: false }) }}
            </span>
            <span v-else class="text-xs text-gray-400">尚未发布过公告</span>

            <BaseButton
              variant="primary"
              :loading="saving"
              @click="saveAnnouncement"
            >
              <div class="i-carbon-send-alt mr-1.5" />
              <span>保存并立即发布公告</span>
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
