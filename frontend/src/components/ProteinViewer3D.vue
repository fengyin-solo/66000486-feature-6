<template>
  <div class="panel">
    <h3>🔬 3D蛋白骨架 (Cα原子轨迹)</h3>
    <div ref="container" class="viewer3d"></div>
    <p class="info" v-if="store.selectedConformation">
      当前: φ={{ store.selectedConformation.phi.toFixed(1) }}° ψ={{ store.selectedConformation.psi.toFixed(1) }}° 能量={{ store.selectedConformation.energy.toFixed(2) }} kcal/mol
    </p>
    <p class="info" v-else>点击Ramachandran图或表格中的构象以查看3D骨架</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useProteinStore } from '../store/protein'

const store = useProteinStore()
const container = ref<HTMLDivElement>()
let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer
let controls: OrbitControls, animationId: number
let backboneGroup = new THREE.Group()

function initScene() {
  if (!container.value) return
  const w = container.value.clientWidth, h = container.value.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  scene.fog = new THREE.Fog(0x1a1a2e, 5, 20)

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
  camera.position.set(3, 2, 6)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.1

  scene.add(new THREE.AmbientLight(0x404060, 1.5))
  const dl = new THREE.DirectionalLight(0xffffff, 1.2)
  dl.position.set(5, 5, 5)
  scene.add(dl)
  const dl2 = new THREE.DirectionalLight(0x6688cc, 0.6)
  dl2.position.set(-3, -2, -5)
  scene.add(dl2)

  const grid = new THREE.GridHelper(8, 20, 0x444466, 0x222244)
  scene.add(grid)

  scene.add(backboneGroup)
}

function buildBackbone(phi: number, psi: number) {
  backboneGroup.clear()
  const bondLen = 1.47
  const angle = 109.5 * Math.PI / 180

  let pos = new THREE.Vector3(0, 0, 0)
  let dir = new THREE.Vector3(1, 0, 0)

  const caMat = new THREE.MeshPhongMaterial({ color: 0x44aaff, emissive: 0x112244 })
  const nMat = new THREE.MeshPhongMaterial({ color: 0x3355cc, emissive: 0x111133 })
  const cMat = new THREE.MeshPhongMaterial({ color: 0xff6644, emissive: 0x331111 })
  const bondMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa })

  const residues = store.result?.params.residues || 8

  for (let i = 0; i < residues; i++) {
    const nPos = pos.clone()
    const nSphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), nMat)
    nSphere.position.copy(nPos)
    backboneGroup.add(nSphere)

    const caPos = nPos.clone().add(dir.clone().multiplyScalar(0.49))
    const caSphere = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 16), caMat)
    caSphere.position.copy(caPos)
    backboneGroup.add(caSphere)

    const cPos = caPos.clone().add(dir.clone().multiplyScalar(0.53))
    const cSphere = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), cMat)
    cSphere.position.copy(cPos)
    backboneGroup.add(cSphere)

    for (const [a, b] of [[nPos, caPos], [caPos, cPos]] as [THREE.Vector3, THREE.Vector3][]) {
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const dist = a.distanceTo(b)
      const bondGeom = new THREE.CylinderGeometry(0.07, 0.07, dist, 8)
      const bond = new THREE.Mesh(bondGeom, bondMat)
      bond.position.copy(mid)
      const bLocal = b.clone().sub(a).normalize()
      bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bLocal)
      backboneGroup.add(bond)
    }

    const nextDir = dir.clone()
    nextDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle - Math.PI / 2)
    nextDir.applyAxisAngle(dir, psi * Math.PI / 180)
    pos = cPos.clone().add(nextDir.clone().multiplyScalar(0.49))
    dir = nextDir
  }

  const box = new THREE.Box3().setFromObject(backboneGroup)
  const center = new THREE.Vector3()
  box.getCenter(center)
  backboneGroup.position.sub(center)
}

function animate() {
  animationId = requestAnimationFrame(animate)
  controls.update()
  backboneGroup.rotation.y += 0.001
  renderer.render(scene, camera)
}

function onResize() {
  if (!container.value) return
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
}

onMounted(() => {
  initScene()
  buildBackbone(-60, -45)
  animate()
  window.addEventListener('resize', onResize)
})

watch(() => store.selectedConformation, (conf) => {
  if (conf) buildBackbone(conf.phi, conf.psi)
})

// Rebuild for a batch restored from the address (or a fresh sampling).
watch(() => store.result, () => {
  const conf = store.selectedConformation
  if (conf) buildBackbone(conf.phi, conf.psi)
  else buildBackbone(-60, -45)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  renderer?.dispose()
})
</script>

<style scoped>
.panel { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.panel h3 { margin-bottom: 12px; color: #333; }
.viewer3d { width: 100%; height: 380px; border-radius: 8px; overflow: hidden; border: 1px solid #eee; }
.info { text-align: center; margin-top: 10px; font-size: 13px; color: #666; }
</style>