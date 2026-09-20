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
      <el-radio-group v-model="store.selectedRegion" @change="onRegion">
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
const emit = defineEmits<{ sample: [params: { residues: number; conformations: number }] }>()
const store = useProteinStore()
const form = reactive({ residues: store.params.residues, conformations: store.params.conformations })
function emitSample() { emit("sample", { ...form }) }
function onRegion(val: string) { store.filterByRegion(val) }
// Keep the inputs in step with the batch restored from the address/cache.
watch(() => store.params, p => {
  form.residues = p.residues
  form.conformations = p.conformations
}, { deep: true })
</script>

<style scoped>
.control-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.filters { margin-top: 12px; }
</style>
