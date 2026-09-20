<template>
  <div class="panel">
    <h3>📊 Ramachandran图 (φ-ψ 二面角空间)</h3>
    <canvas ref="cvs" width="500" height="500" class="plot-canvas"></canvas>
    <div class="legend">
      <span class="dot a"></span> α-螺旋 <span class="dot b"></span> β-折叠
      <span class="dot l"></span> 左手螺旋 <span class="dot d"></span> 禁阻区
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue"
import { useProteinStore } from "../store/protein"
const store = useProteinStore()
const cvs = ref<HTMLCanvasElement>()

const colors: Record<string,string> = {"alpha-helix":"#4ecdc4","beta-sheet":"#ff6b6b","left-helix":"#45b7d1","disallowed":"#ddd"}

function draw() {
  const c = cvs.value!; const ctx = c.getContext("2d")!; const W=c.width,H=c.height
  ctx.clearRect(0,0,W,H)
  ctx.strokeStyle="#e8e8e8"; ctx.lineWidth=1
  for(let a=-180;a<=180;a+=30){
    let x=((a+180)/360)*W; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke()
    let y=((a+180)/360)*H; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke()
  }
  ctx.fillStyle="rgba(78,205,196,.08)"; ctx.fillRect(((20)/360)*W,((120)/360)*H,(70/360)*W,(70/360)*H)
  ctx.fillStyle="rgba(255,107,107,.08)"; ctx.fillRect(((225)/360)*W,((0)/360)*H,(120/360)*W,(70/360)*H)
  ctx.strokeStyle="#999"; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke()
  ctx.fillStyle="#666"; ctx.font="12px sans-serif"
  ctx.fillText("φ →",W-30,H/2-6); ctx.fillText("ψ ↑",W/2+6,16)
  const confs = (store.result?.conformations||[]).filter(c=>store.selectedRegion==="all"||c.region===store.selectedRegion)
  const es = confs.map(c=>c.energy); const eMin=Math.min(...es),eMax=Math.max(...es)
  for(const cf of confs){
    const x = ((cf.phi+180)/360)*W, y = H-((cf.psi+180)/360)*H
    const t = (cf.energy-eMin)/(eMax-eMin||1), r = 3 + (Number.isFinite(t)?t:0)*3
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2)
    ctx.fillStyle=colors[cf.region]||"#999"; ctx.fill()
    ctx.strokeStyle="rgba(0,0,0,.1)"; ctx.stroke()
  }
  if(store.selectedConformation){
    const sc=store.selectedConformation
    ctx.beginPath(); ctx.arc(((sc.phi+180)/360)*W, H-((sc.psi+180)/360)*H, 8, 0, Math.PI*2)
    ctx.strokeStyle="#333"; ctx.lineWidth=3; ctx.stroke()
  }
}
onMounted(draw)
watch(()=>[store.result,store.selectedConformation,store.selectedRegion],draw,{deep:true})
</script>

<style scoped>
.panel{background:#fff;border-radius:8px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.panel h3{margin-bottom:12px;color:#333}
.plot-canvas{display:block;margin:0 auto;border:1px solid #eee;border-radius:8px}
.legend{display:flex;gap:16px;justify-content:center;margin-top:12px;font-size:13px}
.legend .dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:4px;vertical-align:middle}
.dot.a{background:#4ecdc4}.dot.b{background:#ff6b6b}.dot.l{background:#45b7d1}.dot.d{background:#ddd}
</style>
