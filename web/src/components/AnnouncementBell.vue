<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '@/api'

interface AnnouncementItem {
  id: string
  title: string
  content: string
  category: string
  pinned: boolean
  enabled: boolean
  createdAt: number
  updatedAt: number
  read: boolean
}

const CATEGORY_MAP: Record<string, { label: string, color: string, icon: string }> = {
  notice: { label: '通知', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200/60 dark:border-blue-700/40', icon: 'i-carbon-notification' },
  activity: { label: '活动', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200/60 dark:border-amber-700/40', icon: 'i-carbon-gift' },
  maintenance: { label: '维护', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200/60 dark:border-rose-700/40', icon: 'i-carbon-warning-alt' },
  guide: { label: '指南', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-700/40', icon: 'i-carbon-book' },
}

const showModal = ref(false)
const loading = ref(false)
const announcements = ref<AnnouncementItem[]>([])
const unreadCount = ref(0)
const expandedIds = ref<Set<string>>(new Set())

// 是否有未读：红点依据
const hasUnread = computed(() => unreadCount.value > 0)

// 格式化日期：例如 "10月17日 09:20"
function formatDate(timestamp?: number) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}月${day}日 ${h}:${min}`
}

// 获取公告列表
async function fetchAnnouncements() {
  try {
    const res = await api.get('/api/announcements')
    if (res.data?.ok && res.data.data) {
      announcements.value = res.data.data.list || []
      unreadCount.value = Number(res.data.data.unreadCount) || 0
      // 默认自动展开第 1 条置顶未读公告
      const firstUnread = announcements.value.find(a => !a.read)
      if (firstUnread) {
        expandedIds.value.add(firstUnread.id)
      } else if (announcements.value.length > 0) {
        expandedIds.value.add(announcements.value[0].id)
      }
    }
  } catch {}
}

// 展开/折叠单条公告
async function toggleExpand(item: AnnouncementItem) {
  if (expandedIds.value.has(item.id)) {
    expandedIds.value.delete(item.id)
  } else {
    expandedIds.value.add(item.id)
    // 展开时如果未读，自动标记单条为已读
    if (!item.read) {
      item.read = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
      try {
        await api.post('/api/announcements/read', { id: item.id })
      } catch {}
    }
  }
}

// 全部标为已读
async function markAllAsRead() {
  announcements.value.forEach(a => a.read = true)
  unreadCount.value = 0
  try {
    await api.post('/api/announcements/read', { id: 'all' })
  } catch {}
}

function openAnnouncementCenter() {
  showModal.value = true
  void fetchAnnouncements()
}

onMounted(() => {
  // 稍作延迟拉取公告状态，保证首屏资源优先
  setTimeout(() => {
    void fetchAnnouncements()
  }, 800)
})
</script>

<template>
  <div class="relative flex items-center">
    <!-- 铃铛按钮：使用用户专属的 xiaoxitixing.svg 矢量图标 -->
    <button
      type="button"
      class="relative h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95 cursor-pointer hover:bg-white/60 dark:hover:bg-gray-800/60"
      title="全站系统公告中心"
      @click="openAnnouncementCenter"
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

    <!-- 公告列表弹窗：iOS 液态毛玻璃设计风格 -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[10080] flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-md"
        @click.self="showModal = false"
      >
        <div
          class="max-h-[85vh] max-w-xl w-full flex flex-col overflow-hidden rounded-3xl border border-white/80 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 shadow-2xl backdrop-blur-2xl"
          @click.stop
        >
          <!-- 弹窗头部：柔光喇叭 + 标题 + 全部已读 + 关闭按钮 -->
          <div class="flex items-center justify-between border-b border-gray-100/80 px-5 py-4 dark:border-gray-800/80">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 flex items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 font-bold dark:bg-amber-500/20">
                <div class="i-carbon-bullhorn text-lg" />
              </div>
              <div class="flex items-center gap-2">
                <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                  系统公告
                </h3>
                <span
                  v-if="unreadCount > 0"
                  class="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs"
                >
                  {{ unreadCount }} 未读
                </span>
              </div>
            </div>

            <!-- 右侧操作栏：一键已读 + 关闭 -->
            <div class="flex items-center gap-2">
              <button
                v-if="unreadCount > 0"
                type="button"
                class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                @click="markAllAsRead"
              >
                全部标为已读
              </button>

              <button
                type="button"
                class="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title="关闭"
                @click="showModal = false"
              >
                <div class="i-carbon-close text-lg" />
              </button>
            </div>
          </div>

          <!-- 公告列表滚动区 -->
          <div class="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            <div v-if="announcements.length === 0" class="py-16 text-center text-gray-400">
              <div class="i-carbon-bullhorn text-4xl inline-block mb-2 opacity-30" />
              <div class="text-xs">暂无任何官方公告</div>
            </div>

            <!-- 手风琴可折叠卡片列表 -->
            <div
              v-for="item in announcements"
              :key="item.id"
              class="rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer"
              :class="item.read
                ? 'border-gray-200/60 bg-gray-50/60 dark:border-gray-800/60 dark:bg-gray-800/30'
                : 'border-blue-200/80 bg-white dark:border-blue-500/30 dark:bg-gray-800/90 shadow-sm'"
              @click="toggleExpand(item)"
            >
              <!-- 卡片头部：标签 + 标题 + 时间 + 展开指示 -->
              <div class="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <!-- 未读蓝点 -->
                  <span
                    v-if="!item.read"
                    class="h-2 w-2 rounded-full bg-blue-500 shrink-0 shadow-sm shadow-blue-500/50"
                  />

                  <!-- 分类小徽章 -->
                  <span
                    class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border shrink-0"
                    :class="CATEGORY_MAP[item.category]?.color || CATEGORY_MAP.notice.color"
                  >
                    <span :class="CATEGORY_MAP[item.category]?.icon || 'i-carbon-notification'" class="text-xs" />
                    <span>{{ CATEGORY_MAP[item.category]?.label || '通知' }}</span>
                  </span>

                  <!-- 置顶标 -->
                  <span
                    v-if="item.pinned"
                    class="inline-flex items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 shrink-0"
                  >
                    <span>📌</span>
                  </span>

                  <!-- 标题 -->
                  <h4
                    class="text-xs sm:text-sm truncate font-bold"
                    :class="item.read ? 'text-gray-600 dark:text-gray-400 font-normal' : 'text-gray-900 dark:text-gray-100'"
                  >
                    {{ item.title }}
                  </h4>
                </div>

                <!-- 右侧：发布时间与折叠箭头 -->
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11px] text-gray-400 font-mono hidden sm:inline">
                    {{ formatDate(item.createdAt) }}
                  </span>
                  <div
                    class="i-carbon-chevron-down text-xs text-gray-400 transition-transform duration-200"
                    :class="{ 'rotate-180': expandedIds.has(item.id) }"
                  />
                </div>
              </div>

              <!-- 卡片正文：展开动画呈现 -->
              <div
                v-if="expandedIds.has(item.id)"
                class="px-4 pb-4 pt-1 border-t border-gray-100/70 dark:border-gray-800/60"
              >
                <div class="sm:hidden text-[10px] text-gray-400 font-mono mb-2">
                  发布于：{{ formatDate(item.createdAt) }}
                </div>
                <div class="text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                  {{ item.content }}
                </div>
              </div>
            </div>
          </div>

          <!-- 弹窗底部 -->
          <div class="border-t border-gray-100/80 p-3 sm:p-4 dark:border-gray-800/80 bg-gray-50/60 dark:bg-gray-900/40 flex justify-between items-center text-xs text-gray-400">
            <span>点击任意公告即可展开阅读并标为已读</span>
            <button
              type="button"
              class="px-4 py-1.5 rounded-xl font-bold text-gray-700 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              @click="showModal = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>


