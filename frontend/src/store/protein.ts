import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { Conformation, SamplingResult, ProteinParams } from '@/types'
import { REGION_ALL, readUrlState, pushUrlState, replaceUrlState, type UrlState } from '@/utils/url'
import { getCachedBatch, getLatestBatch, saveBatch, updateBatchView, type CachedBatch } from '@/utils/cache'

const DEFAULT_PARAMS: ProteinParams = { residues: 10, conformations: 1000 }
const FALLBACK_NOTICE = '链接指向的采样结果已被替换或清空，已回退到最近一次可用状态。'
const EMPTY_NOTICE = '链接指向的采样结果已被替换或清空，且没有可用的历史状态。'

export const useProteinStore = defineStore('protein', () => {
  const loading = ref(false)
  const result = ref<SamplingResult | null>(null)
  const selectedConformation = ref<Conformation | null>(null)
  // "区域条件"：全部 / α-螺旋 / β-折叠 / 左手螺旋 / 禁阻区
  const selectedRegion = ref<string>(REGION_ALL)
  const params = ref<ProteinParams>({ ...DEFAULT_PARAMS })
  const notice = ref<string | null>(null)

  function currentUrlState(): UrlState {
    return {
      batchId: result.value?.id ?? null,
      region: selectedRegion.value,
      selectedId: selectedConformation.value?.id ?? null,
    }
  }

  // Region filter / selection changes must survive refresh and back/forward:
  // mirror them into both the address bar and the cached batch view.
  function syncView() {
    if (!result.value) return
    const state = currentUrlState()
    replaceUrlState(state)
    updateBatchView(result.value.id, { region: state.region, selectedId: state.selectedId })
  }

  async function runSampling(nextParams: ProteinParams) {
    loading.value = true
    // Drop the previous batch first so stale rows can never leak into the new one.
    result.value = null
    selectedConformation.value = null
    selectedRegion.value = REGION_ALL
    notice.value = null
    try {
      const { data } = await axios.post<SamplingResult>('/api/sample', nextParams)
      result.value = data
      params.value = { ...data.params }
      saveBatch(data, { region: REGION_ALL, selectedId: null })
      pushUrlState({ batchId: data.id, region: REGION_ALL, selectedId: null })
    } finally {
      loading.value = false
    }
  }

  function selectConformation(conf: Conformation | null) {
    selectedConformation.value = conf
    syncView()
  }

  function filterByRegion(region: string) {
    selectedRegion.value = region
    syncView()
  }

  function dismissNotice() { notice.value = null }

  function applyEntry(
    entry: CachedBatch,
    region: string,
    selectedId: number | null,
    noticeText: string | null,
  ) {
    result.value = entry.result
    params.value = { ...entry.result.params }
    selectedRegion.value = region
    const conf = selectedId !== null
      ? entry.result.conformations.find(c => c.id === selectedId) ?? null
      : null
    selectedConformation.value = conf
    const state: UrlState = {
      batchId: entry.result.id,
      region,
      selectedId: conf ? selectedId : null,
    }
    replaceUrlState(state)
    updateBatchView(entry.result.id, { region, selectedId: state.selectedId })
    if (selectedId !== null && !conf) {
      notice.value = (noticeText ? noticeText + ' ' : '') + '原选中记录不存在，已取消选中。'
    } else {
      notice.value = noticeText
    }
  }

  // Rehydrate the whole page (batch, region filter, selected record) from the
  // address bar. Used on first load and on browser back/forward. A missing
  // batch (replaced/cleared on the server) falls back to the newest cached one.
  async function restoreFromLocation(): Promise<void> {
    const st = readUrlState()
    notice.value = null

    if (!st.batchId) {
      const latest = getLatestBatch()
      if (latest) {
        applyEntry(latest, latest.region, latest.selectedId, null)
      } else {
        result.value = null
        selectedConformation.value = null
        selectedRegion.value = REGION_ALL
      }
      return
    }

    let entry = getCachedBatch(st.batchId)

    if (!entry) {
      loading.value = true
      try {
        const { data } = await axios.get<SamplingResult>(`/api/batch/${st.batchId}`)
        saveBatch(data, { region: st.region, selectedId: st.selectedId })
        entry = getCachedBatch(st.batchId)
      } catch {
        entry = null
      } finally {
        loading.value = false
      }
    }

    if (entry) {
      applyEntry(entry, st.region, st.selectedId, null)
      return
    }

    // The batch in the address is gone from both the server and this browser.
    const fallback = getLatestBatch()
    if (fallback) {
      applyEntry(fallback, fallback.region, fallback.selectedId, FALLBACK_NOTICE)
    } else {
      result.value = null
      selectedConformation.value = null
      selectedRegion.value = REGION_ALL
      notice.value = EMPTY_NOTICE
      replaceUrlState({ batchId: null, region: REGION_ALL, selectedId: null })
    }
  }

  function bindPopState() {
    window.addEventListener('popstate', () => { void restoreFromLocation() })
  }

  return {
    loading, result, selectedConformation, selectedRegion, params, notice,
    runSampling, selectConformation, filterByRegion, restoreFromLocation,
    bindPopState, dismissNotice,
  }
})
