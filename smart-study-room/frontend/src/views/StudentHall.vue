<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getRooms, getSeatMap } from '../api/room'
import { eventCapacity, eventPresentation, sampleEvents } from '../utils/eventCatalog'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const rooms = ref([])
const loading = ref(true)
const sample = ref(false)
const query = ref('')
const category = ref('全部')
const occupancy = ref({})
const categories = ['全部', '观影', '宣讲', '竞赛', '户外']
const visible = computed(() => rooms.value.filter((room) => {
  const meta = eventPresentation(room)
  return (category.value === '全部' || meta.category === category.value) &&
    `${room.name} ${room.location} ${room.description || ''}`.toLowerCase().includes(query.value.trim().toLowerCase())
}))
const headline = computed(() => sample.value ? '活动展示样例' : `${rooms.value.length} 场活动开放报名`)

function used(room) {
  return occupancy.value[room.id]
}

function openEvent(room) {
  router.push(`/events/${room.id}`)
}

onMounted(async () => {
  try {
    const response = await getRooms()
    rooms.value = response.data || []
  } catch {
    rooms.value = []
  }
  if (!rooms.value.length) {
    sample.value = true
    rooms.value = sampleEvents
  } else {
    const today = new Date().toISOString().slice(0, 10)
    const results = await Promise.allSettled(rooms.value.map(async (room) => {
      const response = await getSeatMap(room.id, today, room.open_time.slice(0, 5), room.close_time.slice(0, 5))
      return { id: room.id, count: (response.data.seats || []).filter((seat) => seat.occupied).length }
    }))
    occupancy.value = Object.fromEntries(results.filter((result) => result.status === 'fulfilled').map((result) => [result.value.id, result.value.count]))
  }
  loading.value = false
})
</script>

<template>
  <div class="page-view event-hall">
    <header class="hall-header" data-page-title>
      <div><span class="hall-eyebrow">CAMPUS EVENTS / 校园活动大厅</span><h1>发现校园里的下一场精彩</h1><p>从观影交流到职业探索，找到属于你的活动。</p></div>
      <div class="hall-count"><AppIcon name="ticket" :size="20" /><span>{{ headline }}</span></div>
    </header>
    <div class="hall-tools">
      <label class="hall-search"><span class="sr-only">搜索活动</span><AppIcon name="search" :size="18" /><input v-model="query" type="search" placeholder="搜索活动名称、地点或内容" /></label>
      <div class="hall-categories" role="group" aria-label="活动分类">
        <button v-for="item in categories" :key="item" :class="{ active: category === item }" :aria-pressed="category === item" @click="category = item">{{ item }}</button>
      </div>
    </div>
    <div v-if="sample" class="hall-notice"><AppIcon name="info" :size="17" />当前显示活动样例，连接服务后即可查看并报名真实活动。</div>
    <div v-if="loading" class="hall-empty">正在加载校园活动…</div>
    <div v-else-if="!visible.length" class="hall-empty">没有找到符合条件的活动</div>
    <section v-else class="event-grid" aria-label="活动列表">
      <article v-for="room in visible" :key="room.id" class="event-card" :style="{ '--event-accent': eventPresentation(room).color }">
        <button class="event-card-image" :aria-label="`查看${room.name}详情`" @click="openEvent(room)"><img :src="eventPresentation(room).poster" :alt="`${room.name}活动插画`" /><span class="event-kind">{{ eventPresentation(room).category }}</span></button>
        <div class="event-card-content">
          <div class="event-host"><span class="host-mark">{{ eventPresentation(room).symbol }}</span>{{ eventPresentation(room).host }}</div>
          <h2>{{ room.name }}</h2>
          <p class="event-note">{{ room.description || eventPresentation(room).note }}</p>
          <div class="event-facts"><span><AppIcon name="booking" :size="16" />{{ room.open_time?.slice(0, 5) }}–{{ room.close_time?.slice(0, 5) }}</span><span><AppIcon name="building" :size="16" />{{ room.location }}</span></div>
          <div class="event-capacity"><div><span>{{ eventPresentation(room).outdoor ? '户外活动 · 无固定座位' : used(room) === undefined ? '座位信息请进入详情查看' : `今日已报名 ${used(room)} / ${eventCapacity(room)}` }}</span><strong v-if="used(room) !== undefined">{{ Math.max(0, eventCapacity(room) - used(room)) }} 个余位</strong></div><div v-if="used(room) !== undefined" class="capacity-track"><span :style="{ width: `${Math.min(100, used(room) / Math.max(1, eventCapacity(room)) * 100)}%` }" /></div></div>
          <button class="event-open" @click="openEvent(room)">查看详情 <AppIcon name="chevron-right" :size="17" /></button>
        </div>
      </article>
    </section>
  </div>
</template>
