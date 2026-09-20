import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { Conformation, SamplingResult, ProteinParams, RegionFilter } from '@/types'

// ---- 本地缓存：按批次（seed+参数）保存结果，新批与旧批严格隔离 ----
const CACHE_KEY = 'protein-fold:batches'
const MAX_BATCHES = 10
const MAX_CACHE_BYTES = 4 * 1024 * 1024

interface BatchEntry {
  result: SamplingResult
  region: RegionFilter
  selectedId: number | null
  savedAt: number
}

type BatchCache = Record<string, BatchEntry>

function batchIdFor(seed: number, params: ProteinParams): string {
  return `${seed}:${params.residues}:${params.conformations}`
}

function loadCache(): BatchCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as BatchCache) : {}
  } catch {
    return {}
  }
}

function persistCache(cache: BatchCache) {
  // 控制条目数量：保留最近使用的若干批
  let entries = Object.entries(cache).sort((a, b) => b[1].savedAt - a[1].savedAt)
  if (entries.length > MAX_BATCHES) {
    entries = entries.slice(0, MAX_BATCHES)
  }
  // 控制总体积：超限时从最旧的批开始丢弃
  while (entries.length > 1) {
    const json = JSON.stringify(Object.fromEntries(entries))
    if (json.length <= MAX_CACHE_BYTES) break
    entries.pop()
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // 配额等异常时忽略持久化，当前会话状态不受影响
  }
}

function saveBatch(entry: BatchEntry): BatchCache {
  const cache = loadCache()
  cache[batchIdFor(entry.result.seed, entry.result.params)] = entry
  persistCache(cache)
  return cache
}

// ---- 地址编解码：批次、区域条件、选中记录全部进 URL ----
const REGIONS: RegionFilter[] = ['all', 'alpha-helix', 'beta-sheet', 'left-helix', 'disallowed']

interface UrlState {
  seed?: number
  residues?: number
  conformations?: number
  region?: RegionFilter
  selectedId?: number
}

function readUrl(): UrlState {
  const q = new URLSearchParams(window.location.search)
  const seed = Number(q.get('batch') ?? NaN)
  const residues = Number(q.get('residues') ?? NaN)
  const conformations = Number(q.get('conformations') ?? NaN)
  const regionRaw = q.get('region') as RegionFilter | null
  const selectedId = Number(q.get('sel') ?? NaN)
  const s: UrlState = {}
  if (Number.isFinite(seed) && seed >= 1) s.seed = seed
  if (Number.isFinite(residues) && residues >= 1) s.residues = residues
  if (Number.isFinite(conformations) && conformations >= 1) s.conformations = conformations
  if (regionRaw && REGIONS.includes(regionRaw)) s.region = regionRaw
  if (Number.isFinite(selectedId) && selectedId >= 1) s.selectedId = selectedId
  return s
}

function buildUrl(
  result: SamplingResult,
  region: RegionFilter,
  selectedId: number | null
): string {
  const q = new URLSearchParams()
  q.set('batch', String(result.seed))
  q.set('residues', String(result.params.residues))
  q.set('conformations', String(result.params.conformations))
  if (region !== 'all') q.set('region', region)
  if (selectedId != null) q.set('sel', String(selectedId))
  const url = `${window.location.pathname}?${q.toString()}`
  return url
}

export const useProteinStore = defineStore('protein', () => {
  const loading = ref(false)
  const result = ref<SamplingResult | null>(null)
  const selectedConformation = ref<Conformation | null>(null)
  const selectedRegion = ref<RegionFilter>('all')
  const notice = ref<string>('')
  const hydrated = ref(false)

  let currentBatchId: string | null = null
  // 单调递增的请求代号：在途的旧采样/水合完成后若已过期则直接丢弃
  let samplingSeq = 0
  let hydrateSeq = 0

  /** 把当前区域条件/选中项写回缓存与地址（同批内部变化只替换历史项） */
  function syncView(pushHistory = false) {
    if (!result.value || !currentBatchId) return
    const cache = loadCache()
    cache[currentBatchId] = {
      result: result.value,
      region: selectedRegion.value,
      selectedId: selectedConformation.value?.id ?? null,
      savedAt: Date.now(),
    }
    persistCache(cache)
    const url = buildUrl(result.value, selectedRegion.value, selectedConformation.value?.id ?? null)
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history[pushHistory ? 'pushState' : 'replaceState'](null, '', url)
    }
  }

  /** 原子地装入一整批结果，避免旧批数据残留或混入新批 */
  function applyResult(next: SamplingResult, region: RegionFilter, selectedId: number | null): boolean {
    const conf = selectedId != null ? next.conformations.find(c => c.id === selectedId) ?? null : null
    const validRegion: RegionFilter = REGIONS.includes(region) ? region : 'all'
    result.value = next
    selectedRegion.value = validRegion
    selectedConformation.value = conf
    currentBatchId = batchIdFor(next.seed, next.params)
    return conf !== null || selectedId == null
  }

  async function runSampling(params: ProteinParams) {
    const seq = ++samplingSeq
    loading.value = true
    try {
      const seed = Math.floor(Math.random() * 1_999_999_999) + 1
      const { data } = await axios.post<SamplingResult>('/api/sample', { ...params, seed })
      // 过期响应（用户又点了一次采样，或期间通过历史切换）直接丢弃，绝不混入当前批次
      if (seq !== samplingSeq) return
      applyResult(data, 'all', null)
      saveBatch({ result: data, region: 'all', selectedId: null, savedAt: Date.now() })
      syncView(true)
      notice.value = ''
    } catch {
      if (seq === samplingSeq) {
        notice.value = '采样请求失败，当前页面状态保持不变，请稍后重试。'
      }
    } finally {
      if (seq === samplingSeq) loading.value = false
    }
  }

  function selectConformation(conf: Conformation) {
    if (!result.value || !result.value.conformations.some(c => c.id === conf.id)) return
    selectedConformation.value = conf
    syncView()
  }

  function filterByRegion(region: RegionFilter) {
    if (!REGIONS.includes(region)) return
    selectedRegion.value = region
    syncView()
  }

  function latestEntry(excludeId?: string): BatchEntry | null {
    const entries = Object.entries(loadCache())
      .filter(([id]) => id !== excludeId)
      .sort((a, b) => b[1].savedAt - a[1].savedAt)
    return entries.length ? entries[0][1] : null
  }

  function fallbackToLatest(reason: string): boolean {
    const latest = latestEntry()
    if (!latest) {
      result.value = null
      selectedConformation.value = null
      selectedRegion.value = 'all'
      currentBatchId = null
      notice.value = reason
      return false
    }
    applyResult(latest.result, latest.region, latest.selectedId)
    window.history.replaceState(null, '', buildUrl(latest.result, latest.region, latest.selectedId))
    notice.value = reason
    return true
  }

  /** 启动或前进/后退时：让整页状态严格跟随地址 */
  async function hydrateFromUrl(): Promise<void> {
    const hseq = ++hydrateSeq
    samplingSeq++ // 地址切换会使任何在途采样作废
    const s = readUrl()
    if (s.seed == null) {
      // 地址里没有批次：回到初始空状态
      result.value = null
      selectedConformation.value = null
      selectedRegion.value = 'all'
      currentBatchId = null
      notice.value = ''
      window.history.replaceState(null, '', window.location.pathname)
      hydrated.value = true
      return
    }

    const params: ProteinParams = {
      residues: s.residues ?? 10,
      conformations: s.conformations ?? 1000,
    }
    const id = batchIdFor(s.seed, params)
    const cached = loadCache()[id]

    if (cached) {
      if (hseq !== hydrateSeq) return
      // 缓存命中：同一批结果、区域条件、选中记录完整还原
      const complete = applyResult(cached.result, s.region ?? cached.region, s.selectedId ?? cached.selectedId)
      if (!complete) {
        // 选中记录在该批中不存在：留在该批并说明，同时修正地址
        syncView()
        notice.value = '地址指向的构象记录在该批结果中不存在，已清除选中项。'
      } else {
        syncView()
        notice.value = ''
      }
      hydrated.value = true
      return
    }

    // 缓存未命中（别人分享的链接 / 缓存被清空）：用种子向后端复现同一批
    loading.value = true
    try {
      const { data } = await axios.post<SamplingResult>('/api/sample', {
        residues: params.residues,
        conformations: params.conformations,
        seed: s.seed,
      })
      if (hseq !== hydrateSeq) return
      const complete = applyResult(data, s.region ?? 'all', s.selectedId ?? null)
      saveBatch({
        result: data,
        region: selectedRegion.value,
        selectedId: selectedConformation.value?.id ?? null,
        savedAt: Date.now(),
      })
      syncView()
      notice.value = complete
        ? ''
        : '地址指向的构象记录在该批结果中不存在，已清除选中项。'
    } catch {
      if (hseq !== hydrateSeq) return
      // 这批结果既不在缓存中也无法重新获取：回退到最近一次可用状态
      fallbackToLatest('链接指向的采样结果已不可用且无法重新获取，已为你回退到最近一次可用的结果。')
    } finally {
      if (hseq === hydrateSeq) {
        loading.value = false
        hydrated.value = true
      }
    }
  }

  function bindHistory() {
    window.addEventListener('popstate', () => {
      void hydrateFromUrl()
    })
  }

  return {
    loading,
    result,
    selectedConformation,
    selectedRegion,
    notice,
    hydrated,
    runSampling,
    selectConformation,
    filterByRegion,
    hydrateFromUrl,
    bindHistory,
  }
})
