import type { SamplingResult } from '@/types'

// Shared-link state of the page: a result batch plus the region filter and the
// selected record. Recent batches are mirrored in localStorage so the same URL
// can be restored (or used as a fallback) when the server-side batch has been
// replaced/cleared.
const STORAGE_KEY = 'protein-folding-batches'
const BATCH_LIMIT = 3

export interface CachedBatch {
  result: SamplingResult
  region: string
  selectedId: number | null
  savedAt: number
}

type Store = CachedBatch[]

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (b): b is CachedBatch =>
        b && b.result && typeof b.result.id === 'string' && Array.isArray(b.result.conformations),
    )
  } catch {
    return []
  }
}

function writeStore(batches: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches.slice(0, BATCH_LIMIT)))
  } catch {
    // Quota / serialization failures must not break the live page state.
  }
}

export function getCachedBatch(id: string): CachedBatch | null {
  return readStore().find(b => b.result.id === id) ?? null
}

export function getLatestBatch(): CachedBatch | null {
  const batches = readStore()
  return batches.length ? batches[0] : null
}

export function saveBatch(result: SamplingResult, view: { region: string; selectedId: number | null }): CachedBatch {
  const batches = readStore().filter(b => b.result.id !== result.id)
  const entry: CachedBatch = { result, region: view.region, selectedId: view.selectedId, savedAt: Date.now() }
  writeStore([entry, ...batches])
  return entry
}

export function updateBatchView(id: string, view: { region: string; selectedId: number | null }): void {
  const batches = readStore()
  const idx = batches.findIndex(b => b.result.id === id)
  if (idx === -1) return
  const [entry] = batches.splice(idx, 1)
  entry.region = view.region
  entry.selectedId = view.selectedId
  entry.savedAt = Date.now()
  writeStore([entry, ...batches])
}
