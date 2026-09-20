<template>
  <div class="panel" style="margin-top:16px">
    <div class="table-header">
      <h3>📋 构象数据 (共 {{ confs.length }} 条)</h3>
      <el-button size="small" @click="exportCSV">导出 CSV</el-button>
    </div>
    <el-table ref="tableRef" :data="confs" stripe max-height="360" highlight-current-row @row-click="onRowClick" size="small">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="phi" label="φ (°)" width="100">
        <template #default="{ row }">{{ row.phi.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="psi" label="ψ (°)" width="100">
        <template #default="{ row }">{{ row.psi.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="energy" label="LJ能量 (kcal/mol)" width="150">
        <template #default="{ row }">{{ row.energy.toFixed(3) }}</template>
      </el-table-column>
      <el-table-column prop="region" label="构象区域" width="120">
        <template #default="{ row }">
          <el-tag :type="tagType(row.region)" size="small">{{ regionLabel(row.region) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="cluster" label="聚类" />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useProteinStore } from '../store/protein'
import type { Conformation } from '../types'

const store = useProteinStore()
const tableRef = ref<{ setCurrentRow: (row: Conformation | null) => void }>()
const confs = computed(() => (store.result?.conformations || []).filter(c =>
  store.selectedRegion === 'all' || c.region === store.selectedRegion
))

function onRowClick(row: Conformation) { store.selectConformation(row) }
// A selection restored from the address must also highlight its table row.
watch(() => store.selectedConformation, async row => {
  await nextTick()
  tableRef.value?.setCurrentRow(row)
})
watch(() => store.result, async () => {
  await nextTick()
  tableRef.value?.setCurrentRow(store.selectedConformation)
})
function tagType(r: string) {
  const m: Record<string, any> = { 'alpha-helix': 'success', 'beta-sheet': 'danger', 'left-helix': 'warning' }
  return m[r] || 'info'
}
function regionLabel(r: string) {
  const m: Record<string, string> = { 'alpha-helix': 'α-螺旋', 'beta-sheet': 'β-折叠', 'left-helix': '左手螺旋', 'disallowed': '禁阻区' }
  return m[r] || r
}
function exportCSV() {
  const header = 'id,phi,psi,energy,region,cluster\n'
  const rows = confs.value.map(c => `${c.id},${c.phi},${c.psi},${c.energy},${c.region},${c.cluster}`).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'conformations.csv'; a.click()
}
</script>

<style scoped>
.panel { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.table-header h3 { color: #333; font-size: 15px; }
</style>