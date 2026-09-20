export const REGION_ALL = 'all'
export const REGIONS = ['all', 'alpha-helix', 'beta-sheet', 'left-helix', 'disallowed'] as const
export type RegionFilter = (typeof REGIONS)[number]

export interface UrlState {
  batchId: string | null
  region: string
  selectedId: number | null
}

export function normalizeRegion(region: string | null): string {
  return (REGIONS as readonly string[]).includes(region ?? '') ? region as string : REGION_ALL
}

export function readUrlState(url: string = window.location.href): UrlState {
  const params = new URL(url).searchParams
  const selectedRaw = params.get('selected')
  const selectedId = selectedRaw !== null && /^\d+$/.test(selectedRaw) ? Number(selectedRaw) : null
  return {
    batchId: params.get('batch'),
    region: normalizeRegion(params.get('region')),
    selectedId,
  }
}

function buildUrl(state: UrlState): string {
  const url = new URL(window.location.href)
  url.search = ''
  if (state.batchId) url.searchParams.set('batch', state.batchId)
  url.searchParams.set('region', state.region)
  if (state.selectedId !== null) url.searchParams.set('selected', String(state.selectedId))
  return url.pathname + url.search
}

export function pushUrlState(state: UrlState): void {
  window.history.pushState(null, '', buildUrl(state))
}

export function replaceUrlState(state: UrlState): void {
  window.history.replaceState(null, '', buildUrl(state))
}
