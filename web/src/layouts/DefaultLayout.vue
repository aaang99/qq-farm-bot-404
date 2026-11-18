<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import MysteryMerchantBanner from '@/components/shop/MysteryMerchantBanner.vue'
import Sidebar from '@/components/Sidebar.vue'
import TopAccountMenu from '@/components/TopAccountMenu.vue'
import AnnouncementBell from '@/components/AnnouncementBell.vue'
import { resolveScene } from '@/router/scene'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const { loginPageConfig, sidebarOpen } = storeToRefs(appStore)
const route = useRoute()

const activeScene = computed(() => resolveScene(route.path))

const sceneTabs = [
  { key: 'farm' as const, label: '农场', icon: 'i-carbon-sprout', home: '/' },
  { key: 'ranch' as const, label: '牧场', icon: 'i-carbon-workspace', home: '/ranch' },
]

onMounted(() => {
  appStore.fetchLoginPageConfig()
})

onUnmounted(() => {
  // 清理逻辑
})
</script>

<template>
  <div class="layout-root w-screen flex overflow-hidden" style="height: 100dvh;">
    <!-- Mobile Sidebar Overlay with Liquid Blur -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-gray-950/45 backdrop-blur-md transition-opacity lg:hidden"
      @click="appStore.closeSidebar"
    />

    <Sidebar @click="appStore.closeSidebar" />

    <main class="relative z-10 h-full min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
      <!-- Liquid Glass Top Header -->
      <header class="liquid-header relative z-30 mx-2 mt-2 h-16 flex shrink-0 items-center justify-between rounded-2xl px-3 md:mx-4 md:mt-4 md:px-5">
        <!-- 左侧：汉堡按钮（移动端）或标题（桌面端） -->
        <div class="flex items-center gap-2.5 z-10">
          <button
            class="liquid-btn-icon h-9 w-9 flex items-center justify-center rounded-xl text-gray-700 transition lg:hidden hover:bg-white/60 dark:text-gray-200 dark:hover:bg-gray-800/60"
            @click="appStore.toggleSidebar"
          >
            <div class="i-carbon-menu text-xl" />
          </button>

          <div class="hidden text-base font-bold tracking-tight text-gray-800 opacity-90 lg:block dark:text-gray-100">
            {{ loginPageConfig.title && loginPageConfig.title !== 'QQ农场智能助手' ? loginPageConfig.title : 'QQ农场助手控制台' }}
          </div>
        </div>

        <!-- 场景切换：移动端居中，桌面端位于标题右侧 -->
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1 rounded-2xl p-1 lg:static lg:translate-x-0 lg:translate-y-0 lg:p-0 bg-white/55 dark:bg-gray-800/55 lg:bg-transparent dark:lg:bg-transparent">
          <RouterLink
            v-for="scene in sceneTabs"
            :key="scene.key"
            :to="scene.home"
            class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold tracking-wide transition-all duration-200 lg:px-3.5 lg:py-2"
            :class="activeScene === scene.key
              ? 'text-white shadow-[0_2px_10px_rgba(0,0,0,0.12)]'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
            :style="activeScene === scene.key ? { background: 'var(--theme-primary)' } : undefined"
          >
            <div :class="[scene.icon, 'text-[15px]']" />
            <span>{{ scene.label }}</span>
          </RouterLink>
        </div>

        <!-- 右侧：消息提醒铃铛 + 头像胶囊 -->
        <div class="flex items-center gap-2 z-10">
          <AnnouncementBell />
          <TopAccountMenu />
        </div>
      </header>

      <!-- Main Content Area -->
      <div class="min-h-0 flex flex-1 flex-col overflow-hidden">
        <MysteryMerchantBanner />
        <div class="custom-scrollbar min-h-0 flex flex-1 flex-col overflow-y-auto px-2 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-4 md:pt-4 md:pb-6">
          <RouterView v-slot="{ Component }">
            <component :is="Component" />
          </RouterView>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout-root {
  background-image: var(--app-bg-image);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
  position: relative;
}

.layout-root::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(245, 248, 252, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
  z-index: 0;
}

.dark .layout-root::before {
  background: rgba(11, 16, 32, 0.42);
  backdrop-filter: blur(9px);
  -webkit-backdrop-filter: blur(9px);
}

.liquid-header {
  background: var(--liquid-glass-bg);
  backdrop-filter: var(--liquid-glass-blur);
  -webkit-backdrop-filter: var(--liquid-glass-blur);
  border: 1px solid var(--liquid-glass-border);
  box-shadow: var(--liquid-glass-shadow-sm);
  transition: all 0.25s ease;
}

.liquid-btn-icon {
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4);
}

.dark .liquid-btn-icon {
  background: rgba(30, 41, 59, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15);
}

/* Slide Fade Transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease-out;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.35);
  border-radius: 4px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.6);
}

.custom-scrollbar {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
</style>
