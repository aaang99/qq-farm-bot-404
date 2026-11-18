import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import api from '@/api'
import { useAccountStore } from '@/stores/account'

// 两级缓存：
// 1) 内存缓存（WeakMap 按 account store 隔离）—— 同一次会话内切换页面零延迟
// 2) localStorage 持久化 —— 浏览器刷新后仍可立即渲染，避免再次长时间空窗
// 两者都只缓存展示型数据，操作（mutate）后立即失效。
interface CacheEntry { data: any, updatedAt: number }
const memoryCaches = new WeakMap<object, Map<string, CacheEntry>>()
// 内存缓存新鲜期：期内命中不重复请求
const freshTtl = 30000
// localStorage 缓存可用期：期内先渲染旧值（随后静默刷新），超过则视为过期不显示，避免陈旧数值误导
const persistTtl = 5 * 60 * 1000
const storagePrefix = 'ranch_cache_v1:'

function storageKey(accountId: string, page: string) {
  return `${storagePrefix}${accountId}:${page}`
}

function readPersisted(accountId: string, page: string): CacheEntry | undefined {
  try {
    const raw = localStorage.getItem(storageKey(accountId, page))
    if (!raw)
      return undefined
    const parsed = JSON.parse(raw) as CacheEntry
    if (!parsed || typeof parsed.updatedAt !== 'number')
      return undefined
    if (Date.now() - parsed.updatedAt >= persistTtl) {
      localStorage.removeItem(storageKey(accountId, page))
      return undefined
    }
    return parsed
  }
  catch {
    return undefined
  }
}

function writePersisted(accountId: string, page: string, entry: CacheEntry) {
  try {
    localStorage.setItem(storageKey(accountId, page), JSON.stringify(entry))
  }
  catch {}
}

function dropPersisted(accountId: string, page: string) {
  try {
    localStorage.removeItem(storageKey(accountId, page))
  }
  catch {}
}

export function useRanchResource(page: Ref<string>) {
  const account = useAccountStore()
  const memoryCache = memoryCaches.get(account) ?? new Map<string, CacheEntry>()
  memoryCaches.set(account, memoryCache)
  const data = ref<any>(null)
  const actionResult = ref<any>(null)
  const loading = ref(false)
  // 是否已有一个可渲染的快照（缓存命中即为 true），用于区分「加载中」与「确认为空」
  const hydrated = ref(false)
  const busy = ref(false)
  const error = ref('')
  let sequence = 0
  let controller: AbortController | null = null
  const supported = new Set(['friends', 'activity', 'shop', 'illustrated', 'analytics', 'profile'])
  let pendingRefresh: Promise<void> | null = null

  function lookupCache(accountId: string, resourcePage: string): CacheEntry | undefined {
    const mem = memoryCache.get(resourcePage)
    if (mem)
      return mem
    const persisted = readPersisted(accountId, resourcePage)
    if (persisted) {
      memoryCache.set(resourcePage, persisted)
      return persisted
    }
    return undefined
  }

  function storeCache(accountId: string, resourcePage: string, value: any) {
    const entry: CacheEntry = { data: value, updatedAt: Date.now() }
    memoryCache.set(resourcePage, entry)
    writePersisted(accountId, resourcePage, entry)
  }

  function refresh(request: boolean | Event = false) {
    const forceRefresh = request === true
    if (pendingRefresh)
      return pendingRefresh
    const pending = performRefresh(forceRefresh)
    pendingRefresh = pending
    void pending.finally(() => {
      if (pendingRefresh === pending)
        pendingRefresh = null
    })
    return pending
  }

  async function performRefresh(forceRefresh = false) {
    if (!supported.has(page.value) || !account.currentAccountId || loading.value || busy.value || document.hidden)
      return
    const version = sequence
    const accountId = account.currentAccountId
    const resourcePage = page.value
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const res = await api.get(`/api/ranch/${page.value}`, { params: forceRefresh ? { refresh: 'true' } : {}, signal: controller.signal, headers: { 'x-account-id': account.currentAccountId }, timeout: 120000 })
      if (!res.data.ok)
        throw new Error(res.data.error || '牧场数据读取失败')
      if (version === sequence) {
        data.value = res.data.data
        hydrated.value = true
        storeCache(accountId, resourcePage, data.value)
      }
    }
    catch (e: any) {
      if (version === sequence && e.code !== 'ERR_CANCELED')
        error.value = e.response?.data?.error || e.message
    }
    finally {
      if (version === sequence)
        loading.value = false
    }
  }

  watch([page, () => account.currentAccountId], () => {
    sequence++
    controller?.abort()
    pendingRefresh = null
    actionResult.value = null
    error.value = ''
    loading.value = false
    busy.value = false
    const accountId = account.currentAccountId
    const cached = accountId ? lookupCache(accountId, page.value) : undefined
    // 命中缓存：立即渲染，后台静默刷新；未命中：清空并以加载态呈现
    data.value = cached?.data ?? null
    hydrated.value = !!cached
    if (!cached || Date.now() - cached.updatedAt >= freshTtl)
      void refresh()
  }, { immediate: true, flush: 'sync' })

  let timer: ReturnType<typeof setInterval>
  const visible = () => {
    if (!document.hidden)
      void refresh()
  }
  onMounted(() => {
    timer = setInterval(visible, 30000)
    document.addEventListener('visibilitychange', visible)
  })
  onUnmounted(() => {
    sequence++
    controller?.abort()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', visible)
  })

  async function mutate(payload: Record<string, unknown>) {
    if (!account.currentAccountId || busy.value)
      return false
    const version = sequence
    const refreshToWait = pendingRefresh
    busy.value = true
    if (refreshToWait)
      await refreshToWait
    if (version !== sequence)
      return false
    // 任何操作都可能改变对应页面的数据，统一失效
    memoryCache.delete(page.value)
    dropPersisted(account.currentAccountId, page.value)
    busy.value = true
    actionResult.value = null
    error.value = ''
    let actionError = ''
    try {
      const result = await api.post('/api/ranch/action', payload, { headers: { 'x-account-id': account.currentAccountId }, timeout: 120000 })
      if (!result.data.ok)
        throw new Error(result.data.error || '操作失败')
      if (version === sequence)
        actionResult.value = result.data.data
    }
    catch (e: any) { actionError = e.response?.data?.error || e.message || '操作失败' }
    finally {
      if (version === sequence) {
        busy.value = false
        await refresh(true)
        if (version === sequence && actionError)
          error.value = actionError
      }
    }
    return version === sequence && !actionError
  }
  return { data, result: actionResult, loading, hydrated, busy, error, refresh, mutate }
}
