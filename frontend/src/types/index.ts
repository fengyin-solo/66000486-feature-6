export interface Conformation {
  id: number
  phi: number
  psi: number
  energy: number
  region: string
  cluster: string
}

export interface ProteinParams {
  residues: number
  conformations: number
}

export interface SamplingResult {
  params: ProteinParams
  conformations: Conformation[]
  energyRange: [number, number]
  stats: { alpha: number; beta: number; left: number; disallowed: number }
  seed: number
}

export type RegionFilter = 'all' | 'alpha-helix' | 'beta-sheet' | 'left-helix' | 'disallowed'
