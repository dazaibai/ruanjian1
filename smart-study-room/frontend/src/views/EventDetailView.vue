<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRooms, getSeatMap } from '../api/room'
import { eventCapacity, eventPresentation, sampleEvents } from '../utils/eventCatalog'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const room = ref(null)
const sample = ref(false)
const loading = ref(true)
const seats = ref(null)
const meta = computed(() => eventPresentation(room.value))
const capacity = computed(() => eventCapacity(room.value))
const remaining = computed(() => seats.value ? seats.value.filter((seat) => seat.status === 'available' && !seat.occupied).length : null)
const progress = computed(() => seats.value?.length ? Math.round((seats.value.length - remaining.value) / seats.value.length * 100) : 0)

async function load() {
  loading.value = true
  seats.value = null
  const id = String(route.params.id)
  if (id.startsWith('sample-')) {
    room.value = sampleEvents.find((event) => event.id === id) || null
    sample.value = true
  } else {
    sample.value = false
    try {
      const response = await getRooms()
      room.value = (response.data || []).find((event) => String(event.id) === id) || null
      if (room.value) {
        const today = new Date().toISOString().slice(0, 10)
        const map = await getSeatMap(room.value.id, today, room.value.open_time.slice(0, 5), room.value.close_time.slice(0, 5))
        seats.value = map.data.seats || []
      }
    } catch { /* Detail remains available when seat counts cannot be loaded. */ }
  }
  loading.value = false
}
onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="page-view event-detail">
    <button class="text-back" @click="router.push('/')"><AppIcon name="chevron-right" :size="17" />返回活动大厅</button>
    <div v-if="loading" class="hall-empty">正在加载活动…</div>
    <div v-else-if="!room" class="hall-empty">活动不存在或已下线</div>
    <template v-else>
      <header class="detail-head" :style="{ '--event-accent': meta.color }" data-page-title>
        <div class="detail-cover"><img :src="meta.poster" :alt="`${room.name}活动插画`" /></div>
        <div class="detail-main"><div class="detail-tags"><span>{{ meta.category }}</span><span>{{ sample ? '展示样例' : '开放报名' }}</span></div><h1>{{ room.name }}</h1><p>{{ room.description || meta.note }}</p><div class="detail-host"><span class="host-mark">{{ meta.symbol }}</span><span>{{ meta.host }}</span></div></div>
      </header>
      <div class="detail-grid">
        <section class="detail-section"><h2>活动信息</h2><dl><div><dt>活动时间</dt><dd>{{ room.open_time?.slice(0, 5) }}–{{ room.close_time?.slice(0, 5) }}</dd></div><div><dt>活动地点</dt><dd>{{ room.location }}</dd></div><div><dt>参与方式</dt><dd>{{ meta.outdoor ? '现场集合 · 无固定座位' : '在线报名 · 自主选座 · 现场签到' }}</dd></div></dl></section>
        <aside class="detail-section detail-signup"><h2>报名名额</h2><div class="detail-big">{{ meta.outdoor ? '现场参与' : remaining ?? capacity }}<small>{{ meta.outdoor ? '无固定座位' : remaining === null ? '座位规模' : '剩余座位' }}</small></div><div v-if="!meta.outdoor && seats" class="capacity-track"><span :style="{ width: `${progress}%` }" /></div><p v-if="meta.outdoor" class="outdoor-note"><AppIcon name="info" :size="18" />户外活动，无固定座位，请按现场指引参与。集合点：{{ room.location }}。</p><p v-else>选座后提交报名，活动开始前请按时签到。无障碍需求可联系主办方安排。</p><button v-if="!sample && !meta.outdoor" class="primary-command" @click="router.push({ path: '/booking', query: { room: room.id } })">{{ remaining === 0 ? '查看候补选项' : '立即选座报名' }}<AppIcon name="chevron-right" :size="18" /></button><button v-else class="primary-command" disabled>{{ sample ? '展示样例 · 暂不可报名' : '请按现场指引参与' }}</button></aside>
        <section class="detail-section detail-notice"><h2>参与须知</h2><ul><li>请确认活动时间和地点，提前到场完成签到。</li><li>如需取消报名，请尽早释放名额给候补同学。</li><li>需要无障碍协助时，可在现场联系主办方工作人员。</li></ul><h2 class="zone-title">分区标识示意</h2><div class="zone-reference"><span class="zone-audience">普通观众</span><span class="zone-guest">嘉宾</span><span class="zone-staff">工作人员</span><span class="zone-media">媒体</span><span class="zone-access">无障碍座位</span><span class="zone-blocked">禁选区域</span></div><p class="zone-caption">分区标识为界面规划示意，实际座位属性以选座页为准。</p></section>
      </div>
    </template>
  </div>
</template>
