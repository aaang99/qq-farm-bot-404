<script setup lang="ts">
import { computed } from 'vue'
import RanchAnimalCard from './RanchAnimalCard.vue'

/**
 * 动物卡片网格：1:1 对齐 liyangpengs RanchAnimalsPanel.vue 的 ranch-grid。
 * 按圈舍分组渲染，每圈内部使用同一套卡片。
 */
const props = defineProps<{
  ranches: any[]
  facilities: any[]
  selectedId?: string
  title?: string
  friend?: boolean
  disabled?: boolean
  /** 由父组件按服务器时钟计算好的剩余时间文本，key 为 animalInstId */
  remainingMap?: Record<string, string>
}>()

const emit = defineEmits<{
  select: [id: string]
  animal: [ranchId: string, animalId: string, anchor: HTMLElement]
  produce: [ranchId: string, animalId: string]
  harvest: [ranchId: string, animalId: string]
  feed: [ranchId: string, animalId: string, bucketType: 1 | 2]
  release: [ranchId: string, animalId: string]
  stroke: [ranchId: string, animalId: string]
  open: [ranchId: string, animalId: string, anchor: HTMLElement]
}>()

function facilityFor(ranch: any, facilities: any[]) {
  return facilities.find(f => String(f.ranch?.ranchInstId) === String(ranch.ranchInstId)) || { name: ranch.name }
}

const totalAnimals = computed(() => props.ranches.reduce((sum, r) => sum + (r.animals?.length || 0), 0))
const totalCapacity = computed(() => props.ranches.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0))

function remainingOf(animal: any) {
  return props.remainingMap?.[String(animal.animalInstId)] || ''
}
</script>

<template>
  <div class="ranch-scene">
    <div class="scene-heading">
      <span class="flex items-center gap-2">
        <span class="i-carbon-pet-image-o text-green-600" />{{ title || '我的牧场' }}
        <small class="scene-heading__count">{{ totalAnimals }} / {{ totalCapacity }}</small>
      </span>
    </div>

    <div v-if="!ranches.length" class="ranch-empty">
      <span class="i-carbon-pet-image-o" aria-hidden="true" />
      <strong>还没有饲养动物</strong>
      <p>在牧场商店购买幼崽，到背包里放养到窝或棚。</p>
    </div>

    <div v-else class="ranch-grid">
      <template v-for="ranch in ranches" :key="ranch.ranchInstId">
        <RanchAnimalCard
          v-for="animal in ranch.animals || []"
          :key="animal.animalInstId"
          :animal="animal"
          :pen="facilityFor(ranch, facilities).name"
          :remaining="remainingOf(animal)"
          actionable
          :friend="friend"
          :disabled="disabled"
          @produce="emit('produce', String(ranch.ranchInstId), String(animal.animalInstId))"
          @harvest="emit('harvest', String(ranch.ranchInstId), String(animal.animalInstId))"
          @feed="(t: 1 | 2) => emit('feed', String(ranch.ranchInstId), String(animal.animalInstId), t)"
          @release="emit('release', String(ranch.ranchInstId), String(animal.animalInstId))"
          @stroke="emit('stroke', String(ranch.ranchInstId), String(animal.animalInstId))"
          @open="(anchor: HTMLElement) => emit('open', String(ranch.ranchInstId), String(animal.animalInstId), anchor)"
        />
        <div v-if="!(ranch.animals || []).length" class="ranch-empty-pen">
          <span class="i-carbon-home" aria-hidden="true" />
          <span>{{ facilityFor(ranch, facilities).name }} · 空闲</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ranch-scene {
  --ui-border: #e5e7eb;
  --ui-border-strong: #d1d5db;
  --ui-muted: #6b7280;
  --ui-subtle: #9ca3af;
  --ui-ink: #1f2937;

  position: relative;
  isolation: isolate;
  padding: 16px 20px;
  border-radius: 16px;
}

.scene-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--ui-ink);
  font-size: 16px;
  font-weight: 650;
}

.scene-heading__count {
  color: var(--ui-subtle);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* 与上游 ranch-grid 完全一致 */
.ranch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
}

.ranch-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 16px;
  color: var(--ui-muted);
  text-align: center;
}

.ranch-empty > span {
  margin-bottom: 4px;
  color: var(--ui-subtle);
  font-size: 30px;
}

.ranch-empty strong {
  color: var(--ui-ink);
  font-size: 15px;
}

.ranch-empty p {
  margin: 0 0 8px;
  font-size: 13px;
}

.ranch-empty-pen {
  display: flex;
  min-height: 96px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px dashed var(--ui-border-strong);
  border-radius: 14px;
  color: var(--ui-subtle);
  font-size: 12px;
}

.ranch-empty-pen > span:first-child {
  font-size: 20px;
}

@media (max-width: 639px) {
  .ranch-scene {
    padding-inline: 16px;
  }

  .ranch-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
}

@media (max-width: 400px) {
  .ranch-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.dark .ranch-scene {
  --ui-border: #374151;
  --ui-border-strong: #4b5563;
  --ui-muted: #9ca3af;
  --ui-subtle: #6b7280;
  --ui-ink: #e5e7eb;
}
</style>
