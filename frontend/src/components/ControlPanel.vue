<template>
  <div class="control-card">
    <el-form :model="form" inline>
      <el-form-item label="残基数">
        <el-input-number v-model="form.residues" :min="3" :max="50" />
      </el-form-item>
      <el-form-item label="构象数量">
        <el-input-number v-model="form.conformations" :min="100" :max="5000" :step="100" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="emitSample" :loading="store.loading">🎲 生成构象采样</el-button>
      </el-form-item>
    </el-form>
    <div class="filters" v-if="store.result">
      <el-radio-group :model-value="store.selectedRegion" @change="onRegion">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="alpha-helix">α-螺旋</el-radio-button>
        <el-radio-button label="beta-sheet">β-折叠</el-radio-button>
        <el-radio-button label="left-helix">左手螺旋</el-radio-button>
        <el-radio-button label="disallowed">禁阻区</el-radio-button>
      </el-radio-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue"
import { useProteinStore } from "../store/protein"
import type { ProteinParams, RegionFilter } from "../types"
const emit = defineEmits<{ sample: [params: ProteinParams] }>()
const store = useProteinStore()
const form = reactive({ residues: 10, conformations: 1000 })

// 按地址/缓存恢复（含刷新）后，表单参数跟随当前这批结果
watch(() => store.result, (r) => {
  if (r) {
    form.residues = r.params.residues
    form.conformations = r.params.conformations
  }
}, { immediate: true })

function emitSample() { emit("sample", { ...form }) }
function onRegion(val: RegionFilter) { store.filterByRegion(val) }
</script>

<style scoped>
.control-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.filters { margin-top: 12px; }
</style>
