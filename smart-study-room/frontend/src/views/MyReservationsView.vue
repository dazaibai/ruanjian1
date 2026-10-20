<script setup>
import PageHelp from '../components/PageHelp.vue'
import SAnimatedNumber from '../components/ui/SAnimatedNumber.vue'
import { usePagination } from '../composables/usePagination'
import SPagination from '../components/ui/SPagination.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { message, confirmDialog } from '../components/ui/feedback'
import {
  listMyReservations, cancelReservation, checkinReservation,
  leaveReservation, returnReservation, checkoutReservation
} from '../api/reservation'
import AppIcon from '../components/AppIcon.vue'
import SButton from '../components/ui/SButton.vue'
import STag from '../components/ui/STag.vue'
import SEmpty from '../components/ui/SEmpty.vue'
import SDialog from '../components/ui/SDialog.vue'
import { eventPresentation } from '../utils/eventCatalog'

const list = ref([])
const loading = ref(false)
const filterStatus = ref('all')
const ticket = ref(null)
const now = ref(Date.now())
let clockTimer
const ticketStart = computed(() => ticket.value ? new Date(`${ticket.value.res_date}T${ticket.value.start_time}`).getTime() : 0)
const minutesUntil = computed(() => Math.max(0, Math.ceil((ticketStart.value - now.value) / 60000)))
const ticketPattern = computed(() => {
  const seed = Number(ticket.value?.id || 1)
  return Array.from({ length: 21 * 21 }, (_, index) => {
    const x = index % 21, y = Math.floor(index / 21)
    for (const [left, top] of [[0, 0], [14, 0], [0, 14]]) {
      if (x >= left && x < left + 7 && y >= top && y < top + 7) {
        const a = x - left, b = y - top
        return a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4)
      }
    }
    return (Math.imul(index + seed, 2654435761) >>> 25) % 3 !== 0
  })
})

function addToCalendar(row) {
  const start = `${row.res_date.replaceAll('-', '')}T${row.start_time.slice(0, 5).replace(':', '')}00`
  const end = `${row.res_date.replaceAll('-', '')}T${row.end_time.slice(0, 5).replace(':', '')}00`
  const event = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Campus Events//CN\r\nBEGIN:VEVENT\r\nUID:campus-${row.id}@local\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${row.room_name}\r\nDESCRIPTION:座位 ${row.seat_no}，请按时签到\r\nEND:VEVENT\r\nEND:VCALENDAR`
  const url = URL.createObjectURL(new Blob([event], { type: 'text/calendar;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `活动-${row.res_date}.ics`
  anchor.click()
  URL.revokeObjectURL(url)
}

const statusMeta = {
  pending:     { text: '待签到',   type: 'warning' },
  checked_in:  { text: '活动中',   type: 'success' },
  temp_leave:  { text: '暂离会场', type: 'info' },
  completed:   { text: '已完成',   type: '' },
  cancelled:   { text: '已取消',   type: 'info' },
  violation:   { text: '已违约',   type: 'danger' }
}
const sourceMeta = { manual: '手动选座', auto: '智能分配', waitlist: '候补递补' }

async function load() {
  loading.value = true
  try {
    const resp = await listMyReservations()
    list.value = resp.data || []
  } finally {
    loading.value = false
  }
}

const actionVariant = {
  primary: 'primary',
  danger: 'soft-danger',
  warning: 'soft-warn',
  success: 'soft-success',
  info: 'soft'
}

function actionsOf(r) {
  switch (r.status) {
    case 'pending':
      return [
        { key: 'checkin', label: '签到',     type: 'primary' },
        { key: 'cancel',  label: '取消报名', type: 'danger',  plain: true }
      ]
    case 'checked_in':
      return [
        { key: 'leave',    label: '暂离会场', type: 'warning', plain: true },
        { key: 'checkout', label: '签退',     type: 'primary' }
      ]
    case 'temp_leave':
      return [
        { key: 'return',   label: '返回会场', type: 'success' },
        { key: 'checkout', label: '提前结束', type: 'info',    plain: true }
      ]
    default:
      return []
  }
}

const apiMap = {
  checkin: checkinReservation, cancel: cancelReservation, leave: leaveReservation,
  return: returnReservation, checkout: checkoutReservation
}
const actionText = {
  checkin: '签到', cancel: '取消', leave: '暂离会场', return: '返回', checkout: '签退'
}

async function doAction(r, key) {
  if (key === 'cancel') {
    try {
      await confirmDialog(
        '距开始不足 30 分钟的取消将扣除 2 信用分，确认取消？',
        '取消报名', { confirmButtonText: '确认取消', type: 'warning' }
      )
    } catch { return }
  }
  await apiMap[key](r.id)
  message.success(actionText[key] + '成功')
  load()
}

// 左栏状态快筛
const statusBuckets = computed(() => {
  const b = { all: list.value.length, pending: 0, checked_in: 0, temp_leave: 0, completed: 0, violation: 0 }
  list.value.forEach((r) => { if (b[r.status] !== undefined) b[r.status]++ })
  return b
})
const filtered = computed(() => {
  if (filterStatus.value === 'all') return list.value
  return list.value.filter((r) => r.status === filterStatus.value)
})

const statusNav = [
  { key: 'all',        label: '全部',   icon: 'reservations' },
  { key: 'pending',    label: '待签到', icon: 'waitlist' },
  { key: 'checked_in', label: '活动中', icon: 'circle-success' },
  { key: 'temp_leave', label: '暂离会场', icon: 'walk' },
  { key: 'completed',  label: '已完成', icon: 'check' },
  { key: 'violation',  label: '已违约', icon: 'warning' }
]

onMounted(() => { load(); clockTimer = setInterval(() => { now.value = Date.now() }, 60000) })
onUnmounted(() => clearInterval(clockTimer))
const { page, pages, pageItems } = usePagination(filtered, filterStatus)
</script>

<template>
  <div v-reveal class="page-view">
    <header class="view-heading has-page-help"><div class="heading-copy" data-page-title>
      <h1>我的报名</h1>
      <p class="heading-sub">查看报名记录，完成签到、暂离会场与签退</p>
    </div><PageHelp title="操作说明">
        <ul class="tips">
          <li>开始前 <b>15 分钟</b> 内可签到</li>
          <li>暂离会场时长超过 <b>20 分钟</b> 视为违约</li>
          <li>按期签退 <b>+1 分</b>；未签到违约 <b>-8 分</b></li>
        </ul>
      </PageHelp></header>
    <!-- 我的报名：页面级双栏 = 左状态筛选 | 右列表 -->
    <div class="split mine-split">
    <div class="split-left">
      <section class="card responsive-compact">
        <div class="card-title-row">
          <h3>报名概览</h3>
          <SButton size="sm" variant="secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</SButton>
        </div>
        <div class="kpi-grid kpi-lg">
          <div class="kpi"><div class="kpi-num"><SAnimatedNumber :value="statusBuckets.all" /></div><div class="kpi-label">累计报名</div></div>
          <div class="kpi kpi-warn"><div class="kpi-num"><SAnimatedNumber :value="statusBuckets.pending" /></div><div class="kpi-label">待签到</div></div>
          <div class="kpi kpi-ok"><div class="kpi-num">{{ statusBuckets.checked_in + statusBuckets.temp_leave }}</div><div class="kpi-label">当前进行中</div></div>
          <div class="kpi kpi-bad"><div class="kpi-num"><SAnimatedNumber :value="statusBuckets.violation" /></div><div class="kpi-label">违约记录</div></div>
        </div>
      </section>

      <section class="card responsive-compact">
        <div class="card-title-row">
          <h3>状态筛选</h3>
        </div>
        <nav v-active-track class="side-nav">
          <button
            v-for="s in statusNav"
            :key="s.key"
            class="side-nav-item"
            :class="{ active: filterStatus === s.key }"
            @click="filterStatus = s.key"
          >
            <span class="side-nav-icon"><AppIcon :name="s.icon" :size="16" /></span>
            <span class="side-nav-label">{{ s.label }}</span>
            <span class="side-nav-count">{{ statusBuckets[s.key] ?? 0 }}</span>
          </button>
        </nav>
      </section>

      
    </div>

    <div class="split-right">
      <section class="card">
        <div class="card-title-row">
          <h3>
            报名记录
            <span class="muted">共 {{ filtered.length }} 条</span>
          </h3>
        </div>

        <div v-list-motion="pageItems.map(row => row.id + row.status).join()" class="table-wrap">
          <div class="table-scroll" v-loading="loading" tabindex="0" aria-label="报名记录表格，可左右滑动">
            <table class="table mine-table">
              <thead>
                <tr>
                  <th style="width:106px">日期</th>
                  <th style="width:128px">时段</th>
                  <th style="min-width:118px">活动</th>
                  <th style="width:64px">座位</th>
                  <th style="width:90px">来源</th>
                  <th style="width:96px">状态</th>
                  <th style="width:178px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in pageItems" :key="row.id">
                  <td class="num">{{ row.res_date }}</td>
                  <td class="num">{{ row.start_time.slice(0, 5) }} - {{ row.end_time.slice(0, 5) }}</td>
                  <td>{{ row.room_name }}</td>
                  <td class="cell-strong">{{ row.seat_no }}</td>
                  <td><STag>{{ sourceMeta[row.source] || row.source }}</STag></td>
                  <td>
                    <STag :type="statusMeta[row.status]?.type" dot :line="row.status === 'cancelled'">
                      {{ statusMeta[row.status]?.text || row.status }}
                    </STag>
                  </td>
                  <td>
                    <span class="row-actions">
                      <SButton
                        v-for="a in actionsOf(row)"
                        :key="a.key"
                        size="sm"
                        :variant="actionVariant[a.type]"
                        @click="doAction(row, a.key)"
                      >
                        {{ a.label }}
                      </SButton>
                      <SButton v-if="['pending', 'checked_in', 'temp_leave'].includes(row.status)" size="sm" variant="secondary" @click="ticket = row">凭证</SButton>
                      <span v-if="!actionsOf(row).length" class="cell-dim">—</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <SEmpty v-if="!filtered.length && !loading" description="当前筛选条件下暂无报名记录" />
          </div>
        </div>
        <SPagination v-model="page" :pages="pages" :total="filtered.length" />
      </section>
    </div>
    </div>
    <SDialog :model-value="!!ticket" title="电子报名凭证" width="450px" @update:model-value="ticket = null">
      <div v-if="ticket" class="ticket-preview" :style="{ '--event-accent': eventPresentation({ name: ticket.room_name }).color }">
        <div class="ticket-band"><span>{{ eventPresentation({ name: ticket.room_name }).category }}</span><strong>{{ ticket.room_name }}</strong></div>
        <div class="ticket-qr" role="img" aria-label="二维码视觉示意，不可扫码"><i v-for="(filled, index) in ticketPattern" :key="index" :class="{ filled }" /></div>
        <p class="ticket-demo-label">二维码界面示意 · 暂不可扫码核销</p>
        <strong class="ticket-code">报名编号 #{{ ticket.id }}</strong>
        <dl><div><dt>日期</dt><dd>{{ ticket.res_date }}</dd></div><div><dt>时间</dt><dd>{{ ticket.start_time.slice(0, 5) }}–{{ ticket.end_time.slice(0, 5) }}</dd></div><div><dt>座位</dt><dd>{{ ticket.seat_no }}</dd></div></dl>
        <p v-if="ticket.status === 'pending'" class="ticket-countdown">{{ minutesUntil ? `距活动开始约 ${minutesUntil} 分钟` : '活动已开始，请查看签到状态' }}</p>
        <button class="ticket-calendar" @click="addToCalendar(ticket)"><AppIcon name="booking" :size="17" />加入日历</button>
      </div>
    </SDialog>
  </div>
</template>

<style scoped>


.kpi-lg .kpi-num { font-size: 24px; }
.mine-table { min-width: 776px; }
.mine-table .row-actions {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.mine-table td:nth-child(3) {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
