<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const showModal = ref(false)
const announcement = ref<{
  enabled: boolean
  title: string
  content: string
  showOnce: boolean
  updatedAt: number
  unread: boolean
}>({
  enabled: false,
  title: '系统公告',
  content: '',
  showOnce: true,
  updatedAt: 0,
  unread: false,
})

// 是否显示红点：有未读公告，且公告启用且有内容
const hasUnread = computed(() => {
  return announcement.value.enabled && !!announcement.value.content && announcement.value.unread
})

// 获取最新公告
async function fetchAnnouncement(autoOpenIfUnread = false) {
  try {
    const res = await api.get('/api/announcement')
    if (res.data?.ok && res.data.data) {
      announcement.value = res.data.data
      // 如果未读且需要自动弹出，且当前不在登录页面，首屏展示一次
      if (autoOpenIfUnread && announcement.value.unread && announcement.value.enabled && announcement.value.content && route.path !== '/login') {
        showModal.value = true
      }
    }
  } catch (err) {
    // 忽略未登录等常规错误
  }
}

// 打开弹窗（用户手动点击铃铛）
function openAnnouncement() {
  showModal.value = true
}

// 关闭弹窗并标记已读
async function closeAndMarkRead() {
  showModal.value = false
  if (announcement.value.unread) {
    announcement.value.unread = false
    try {
      await api.post('/api/announcement/read')
    } catch {}
  }
}

onMounted(() => {
  setTimeout(() => {
    void fetchAnnouncement(true)
  }, 600)
})
</script>

<template>
  <div class="relative flex items-center">
    <!-- 铃铛按钮：使用用户专属的 xiaoxitixing.svg 矢量图标 -->
    <button
      type="button"
      class="relative h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95 cursor-pointer hover:bg-white/60 dark:hover:bg-gray-800/60"
      title="全站系统公告"
      @click="openAnnouncement"
    >
      <!-- 用户专属消息提醒图标 (mask 渲染，保证全色彩兼容与暗色适配) -->
      <span
        class="h-5 w-5 bg-gray-700 dark:bg-gray-200 inline-block transition-colors"
        style="mask: url(/xiaoxitixing.svg) no-repeat center / contain; -webkit-mask: url(/xiaoxitixing.svg) no-repeat center / contain;"
      />

      <!-- 闪烁红点 (仅在有未读新公告时显示) -->
      <span
        v-if="hasUnread"
        class="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-900 animate-pulse shadow-sm shadow-rose-500/50"
      />
    </button>

    <!-- 弹窗层：标准稳健透明遮罩，彻底杜绝任何透明度卡死 -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[10080] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md"
        @click.self="closeAndMarkRead"
      >
        <div
          class="max-h-[85vh] max-w-lg w-full flex flex-col overflow-hidden rounded-3xl border border-white/80 dark:border-white/10 bg-white shadow-2xl dark:bg-gray-900"
          @click.stop
        >
          <!-- 弹窗头部：柔光公告喇叭图标 + 标题 + 关闭按钮 -->
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 flex items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 font-bold dark:bg-amber-500/20">
                <div class="i-carbon-bullhorn text-lg" />
              </div>
              <div class="min-w-0">
                <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {{ announcement.title || '系统公告' }}
                </h3>
                <p v-if="announcement.updatedAt" class="text-[11px] text-gray-400 font-mono">
                  发布时间：{{ new Date(announcement.updatedAt).toLocaleDateString('zh-CN') }}
                </p>
              </div>
            </div>

            <!-- 右上角小叉叉关闭 -->
            <button
              type="button"
              class="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
              title="关闭"
              @click="closeAndMarkRead"
            >
              <div class="i-carbon-close text-lg" />
            </button>
          </div>

          <!-- 弹窗正文滚动区 -->
          <div class="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div
              v-if="announcement.content"
              class="text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words"
            >
              {{ announcement.content }}
            </div>
            <div v-else class="py-8 text-center text-xs text-gray-400">
              暂无最新公告内容
            </div>
          </div>

          <!-- 底部“我知道了”按钮 -->
          <div class="border-t border-gray-100 p-4 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/40 flex justify-end">
            <BaseButton
              variant="primary"
              class="w-full sm:w-auto px-6 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 cursor-pointer"
              @click="closeAndMarkRead"
            >
              我知道了
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
