<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface AnnouncementItem {
  id?: string
  title: string
  content: string
  category: string
  pinned: boolean
  enabled: boolean
  createdAt?: number
  updatedAt?: number
}

const CATEGORY_MAP: Record<string, { label: string, color: string, icon: string }> = {
  notice: { label: '通知', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200/60 dark:border-blue-700/40', icon: 'i-carbon-notification' },
  activity: { label: '活动', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200/60 dark:border-amber-700/40', icon: 'i-carbon-gift' },
  maintenance: { label: '维护', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200/60 dark:border-rose-700/40', icon: 'i-carbon-warning-alt' },
  guide: { label: '指南', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-700/40', icon: 'i-carbon-book' },
}

const CATEGORY_OPTIONS = [
  { label: '🔔 通知', value: 'notice' },
  { label: '🎉 活动', value: 'activity' },
  { label: '⚠️ 维护', value: 'maintenance' },
  { label: '💡 指南', value: 'guide' },
]

const loading = ref(false)
const announcements = ref<AnnouncementItem[]>([])

// 编辑/新增弹窗状态
const showModal = ref(false)
const modalSaving = ref(false)
const isEditing = ref(false)
const form = ref<AnnouncementItem>({
  title: '',
  content: '',
  category: 'notice',
  pinned: false,
  enabled: true,
})

// 删除确认状态
const showDeleteConfirm = ref(false)
const itemToDelete = ref<AnnouncementItem | null>(null)
const deleteLoading = ref(false)

async function fetchAnnouncements() {
  loading.value = true
  try {
    const res = await api.get('/api/admin/announcements')
    if (res.data?.ok) {
      announcements.value = res.data.data || []
    }
  } catch (err: any) {
    toastStore.error(err.response?.data?.error || err.message || '获取公告列表失败')
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  isEditing.value = false
  form.value = {
    title: '',
    content: '',
    category: 'notice',
    pinned: false,
    enabled: true,
  }
  showModal.value = true
}

function openEditModal(item: AnnouncementItem) {
  isEditing.value = true
  form.value = { ...item }
  showModal.value = true
}

async function handleSave() {
  if (!form.value.title.trim()) {
    toastStore.warning('请输入公告标题')
    return
  }
  if (!form.value.content.trim()) {
    toastStore.warning('请输入公告内容')
    return
  }
  modalSaving.value = true
  try {
    const res = await api.post('/api/admin/announcements', form.value)
    if (res.data?.ok) {
      toastStore.success(isEditing.value ? '公告更新成功！' : '新公告发布成功！')
      showModal.value = false
      await fetchAnnouncements()
    } else {
      toastStore.error(res.data?.error || '保存失败')
    }
  } catch (err: any) {
    toastStore.error(err.response?.data?.error || err.message || '保存失败')
  } finally {
    modalSaving.value = false
  }
}

async function toggleEnabled(item: AnnouncementItem) {
  try {
    const updated = { ...item, enabled: !item.enabled }
    const res = await api.post('/api/admin/announcements', updated)
    if (res.data?.ok) {
      item.enabled = !item.enabled
      toastStore.success(item.enabled ? '公告已启用' : '公告已暂停展示')
    }
  } catch (err: any) {
    toastStore.error(err.message || '切换状态失败')
  }
}

function confirmDelete(item: AnnouncementItem) {
  itemToDelete.value = item
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (!itemToDelete.value?.id) return
  deleteLoading.value = true
  try {
    const res = await api.delete(`/api/admin/announcements/${itemToDelete.value.id}`)
    if (res.data?.ok) {
      toastStore.success('公告已删除')
      showDeleteConfirm.value = false
      itemToDelete.value = null
      await fetchAnnouncements()
    } else {
      toastStore.error(res.data?.error || '删除失败')
    }
  } catch (err: any) {
    toastStore.error(err.response?.data?.error || err.message || '删除失败')
  } finally {
    deleteLoading.value = false
  }
}

onMounted(() => {
  void fetchAnnouncements()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 管理卡片大壳 -->
    <div class="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-xl backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-800/90 sm:p-6">
      <!-- 头部：标题与新增按钮 -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 dark:border-gray-700/60">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold dark:bg-amber-500/20">
            <div class="i-carbon-bullhorn text-xl" />
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
              系统公告管理
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              管理全站公告列表，支持置顶、分类标签、停用与多用户独立已读提醒。
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <BaseButton variant="primary" size="sm" @click="openCreateModal">
            <div class="i-carbon-add mr-1 text-sm" />
            <span>发布新公告</span>
          </BaseButton>
        </div>
      </div>

      <!-- 列表区 -->
      <div class="pt-4">
        <div v-if="loading && announcements.length === 0" class="py-12 text-center text-gray-400">
          <div class="i-svg-spinners-90-ring-with-bg text-3xl inline-block mb-2" />
          <div class="text-xs">加载公告列表中...</div>
        </div>

        <div v-else-if="announcements.length === 0" class="py-12 text-center text-gray-400">
          <div class="i-carbon-bullhorn text-4xl inline-block mb-2 opacity-30" />
          <div class="text-xs">暂无任何公告，点击右上角发布一条吧！</div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in announcements"
            :key="item.id"
            class="flex flex-col gap-3 p-4 rounded-xl border border-gray-200/70 bg-white/60 dark:bg-gray-800/60 dark:border-gray-700/50 shadow-xs transition-all hover:shadow-md"
            :class="{ 'opacity-60 bg-gray-50/50': !item.enabled }"
          >
            <!-- 第一行：标签、置顶徽章、标题、右侧操作 -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <!-- 置顶标 -->
                <span
                  v-if="item.pinned"
                  class="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 shrink-0"
                >
                  <span class="text-xs">📌</span>
                  <span>置顶</span>
                </span>

                <!-- 分类标 -->
                <span
                  class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border shrink-0"
                  :class="CATEGORY_MAP[item.category]?.color || CATEGORY_MAP.notice.color"
                >
                  <span :class="CATEGORY_MAP[item.category]?.icon || 'i-carbon-notification'" class="text-xs" />
                  <span>{{ CATEGORY_MAP[item.category]?.label || '通知' }}</span>
                </span>

                <!-- 标题 -->
                <h4 class="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                  {{ item.title }}
                </h4>
              </div>

              <!-- 右侧快捷控制：启用/禁用开关、编辑、删除 -->
              <div class="flex items-center gap-2 shrink-0">
                <!-- 开关 -->
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded-lg border font-semibold transition-colors cursor-pointer"
                  :class="item.enabled ? 'border-emerald-200 text-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/30' : 'border-gray-200 text-gray-400 bg-gray-50 dark:bg-gray-700/40'"
                  :title="item.enabled ? '点击暂停展示' : '点击启用展示'"
                  @click="toggleEnabled(item)"
                >
                  {{ item.enabled ? '已启用' : '已停用' }}
                </button>

                <!-- 编辑 -->
                <button
                  type="button"
                  class="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                  title="编辑公告"
                  @click="openEditModal(item)"
                >
                  <div class="i-carbon-edit text-sm" />
                </button>

                <!-- 删除 -->
                <button
                  type="button"
                  class="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  title="删除公告"
                  @click="confirmDelete(item)"
                >
                  <div class="i-carbon-trash-can text-sm" />
                </button>
              </div>
            </div>

            <!-- 正文预览 -->
            <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed whitespace-pre-wrap">
              {{ item.content }}
            </p>

            <!-- 底部发布时间 -->
            <div class="flex items-center justify-between text-[11px] text-gray-400 font-mono pt-1 border-t border-gray-100/60 dark:border-gray-700/40">
              <span>发布时间：{{ new Date(item.createdAt || item.updatedAt || Date.now()).toLocaleString('zh-CN', { hour12: false }) }}</span>
              <span v-if="item.updatedAt && item.createdAt && item.updatedAt !== item.createdAt">（已编辑）</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑公告弹窗 -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[10080] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in"
        @click.self="showModal = false"
      >
        <div
          class="max-h-[90vh] max-w-lg w-full flex flex-col overflow-hidden rounded-3xl border border-white/80 dark:border-white/10 bg-white shadow-2xl dark:bg-gray-900 animate-scale-in"
          @click.stop
        >
          <!-- 弹窗头 -->
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">
              {{ isEditing ? '编辑系统公告' : '发布新公告' }}
            </h3>
            <button
              type="button"
              class="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              @click="showModal = false"
            >
              <div class="i-carbon-close text-lg" />
            </button>
          </div>

          <!-- 弹窗表单 -->
          <div class="custom-scrollbar flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <!-- 标题 -->
            <div>
              <label class="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
                公告标题 <span class="text-rose-500">*</span>
              </label>
              <BaseInput
                v-model="form.title"
                placeholder="例如：奶茶热销中活动全自动开启通知"
                maxlength="50"
              />
            </div>

            <!-- 分类与选项 -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
                  分类标签
                </label>
                <select
                  v-model="form.category"
                  class="w-full rounded-xl border border-gray-200 bg-white/80 p-2.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option v-for="opt in CATEGORY_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <!-- 置顶与立即启用开关 -->
              <div class="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <div>
                  <div class="text-xs font-bold text-gray-700 dark:text-gray-300">
                    置顶公告
                  </div>
                  <p class="text-[10px] text-gray-400">永远固定在列表首位</p>
                </div>
                <BaseSwitch v-model="form.pinned" />
              </div>
            </div>

            <!-- 立即启用展示 -->
            <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div>
                <div class="text-xs font-bold text-gray-700 dark:text-gray-300">
                  立即对外发布展示
                </div>
                <p class="text-[10px] text-gray-400">关闭后仅保存在后台草稿，用户端不展示</p>
              </div>
              <BaseSwitch v-model="form.enabled" />
            </div>

            <!-- 正文 -->
            <div>
              <label class="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
                公告正文内容 <span class="text-rose-500">*</span>
              </label>
              <textarea
                v-model="form.content"
                rows="7"
                class="w-full rounded-xl border border-gray-200 bg-white/80 p-3 text-xs leading-relaxed text-gray-800 placeholder-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100 sm:text-sm"
                placeholder="请输入详细公告内容，支持自然换行与分段..."
              />
            </div>
          </div>

          <!-- 弹窗底部 -->
          <div class="border-t border-gray-100 p-4 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 flex justify-end gap-2">
            <BaseButton variant="secondary" size="sm" @click="showModal = false">
              取消
            </BaseButton>
            <BaseButton variant="primary" size="sm" :loading="modalSaving" @click="handleSave">
              {{ isEditing ? '保存修改' : '确认发布' }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除确认弹窗 -->
    <ConfirmModal
      :show="showDeleteConfirm"
      title="删除公告确认"
      :message="`确定要删除公告【${itemToDelete?.title || ''}】吗？删除后所有用户将无法再查看此条内容。`"
      type="danger"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @close="showDeleteConfirm = false"
    />
  </div>
</template>
