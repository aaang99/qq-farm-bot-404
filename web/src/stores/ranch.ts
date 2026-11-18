import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import api from '@/api'
import { useAccountStore } from './account'

// 与 useRanchResource 相同的两级缓存策略，保证页面切换/刷新后资产数字立即呈现
const freshTtl = 30000
const persistTtl = 5 * 60 * 1000
const storageKey = (accountId: string) => `ranch_cache_v1:${accountId}:status`

function readPersisted(accountId: string): { data: any, updatedAt: number } | undefined {
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (!raw)
      return undefined
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.updatedAt !== 'number')
      return undefined
    if (Date.now() - parsed.updatedAt >= persistTtl) {
      localStorage.removeItem(storageKey(accountId))
      return undefined
    }
    return parsed
  }
  catch {
    return undefined
  }
}

function writePersisted(accountId: string, value: any) {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify({ data: value, updatedAt: Date.now() }))
  }
  catch {}
}

function dropPersisted(accountId: string) {
  try {
    localStorage.removeItem(storageKey(accountId))
  }
  catch {}
}

export const useRanchStore = defineStore('ranch', () => {
  const account = useAccountStore()
  const data = ref<any>(null)
  const loading = ref(false)
  // 是否已有一份可渲染的快照（缓存命中即为 true）
  const hydrated = ref(false)
  const busy = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | null = null
  // 内存缓存：accountId -> 条目，避免每次切换都读 localStorage
  const memory = new Map<string, { data: any, updatedAt: number }>()

  function lookup(accountId: string) {
    const mem = memory.get(accountId)
    if (mem)
      return mem
    const persisted = readPersisted(accountId)
    if (persisted) {
      memory.set(accountId, persisted)
      return persisted
    }
    return undefined
  }

  watch(() => account.currentAccountId, () => {
    generation++
    controller?.abort()
    const accountId = account.currentAccountId
    const cached = accountId ? lookup(accountId) : undefined
    // 有缓存先渲染，不闪空；无缓存才清空
    data.value = cached?.data ?? null
    hydrated.value = !!cached
    error.value = ''
    loading.value = false
    busy.value = false
    if (!cached || Date.now() - cached.updatedAt >= freshTtl)
      void refresh()
  }, { flush: 'sync', immediate: true })

  async function refresh() {
    if (!account.currentAccountId || loading.value || busy.value)
      return
    const version = generation
    const accountId = account.currentAccountId
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const res = await api.get('/api/ranch/status', { timeout: 120000, signal: controller.signal, headers: { 'x-account-id': account.currentAccountId } })
      if (!res.data.ok)
        throw new Error(res.data.error || '牧场读取失败')
      if (version === generation) {
        data.value = res.data.data
        hydrated.value = true
        const entry = { data: data.value, updatedAt: Date.now() }
        memory.set(accountId, entry)
        writePersisted(accountId, data.value)
      }
    }
    catch (e: any) {
      if (version === generation && e.code !== 'ERR_CANCELED')
        error.value = e.response?.data?.error || e.message || '牧场读取失败'
    }
    finally {
      if (version === generation)
        loading.value = false
    }
  }

  async function mutate(path: string, payload: any) {
    if (!account.currentAccountId || busy.value || loading.value)
      return
    const version = generation
    const accountId = account.currentAccountId
    let actionError = ''
    busy.value = true
    error.value = ''
    try {
      const res = await api.post(path, payload, { timeout: 120000, headers: { 'x-account-id': account.currentAccountId } })
      if (!res.data.ok)
        throw new Error(res.data.error || '操作失败')
      if (version === generation && res.data.data?.status) {
        data.value = res.data.data.status
        const entry = { data: data.value, updatedAt: Date.now() }
        memory.set(accountId, entry)
        writePersisted(accountId, data.value)
      }
    }
    catch (e: any) {
      actionError = e.response?.data?.error || e.message || '操作失败'
    }
    finally {
      if (version === generation) {
        busy.value = false
        await refresh()
        if (version === generation && actionError)
          error.value = actionError
      }
    }
  }

  return { data, loading, hydrated, busy, error, refresh, mutate, dropPersisted }
})
