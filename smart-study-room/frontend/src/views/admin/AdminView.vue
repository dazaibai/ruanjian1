<script setup>
import PageHelp from '../../components/PageHelp.vue'
import { ref, onMounted, computed } from 'vue'
import { message, confirmDialog, promptDialog } from '../../components/ui/feedback'
import { getRooms, getSeatMap } from '../../api/room'
import {
  createRoom, updateRoom, deleteRoom, batchGenSeats, updateSeat, listUsers, setUserStatus
} from '../../api/admin'
import AppIcon from '../../components/AppIcon.vue'
import SButton from '../../components/ui/SButton.vue'
import SInput from '../../components/ui/SInput.vue'
import SSelect from '../../components/ui/SSelect.vue'
import SInputNumber from '../../components/ui/SInputNumber.vue'
import SDialog from '../../components/ui/SDialog.vue'
import STag from '../../components/ui/STag.vue'
import SEmpty from '../../components/ui/SEmpty.vue'
import { eventCapacity, eventPresentation, sampleEvents } from '../../utils/eventCatalog'

const activeTab = ref('rooms')

// 时间下拉选项（30 分钟粒度）
function buildTimeOptions(startHour, endHour) {
  const opts = []
  for (let h = startHour; h <= endHour; h++) {
    opts.push({ label: `${String(h).padStart(2, '0')}:00`, value: `${String(h).padStart(2, '0')}:00` })
    if (h < endHour) opts.push({ label: `${String(h).padStart(2, '0')}:30`, value: `${String(h).padStart(2, '0')}:30` })
  }
  return opts
}
const openTimeOptions = buildTimeOptions(5, 12)
const closeTimeOptions = buildTimeOptions(12, 23)

// ---------- 活动场地管理 ----------
const rooms = ref([])
const selectedEventId = ref('')
const dashboardUpdated = ref(new Date())
const attendeeQuery = ref('')
const attendeeFilter = ref('全部')
const dashboardRooms = computed(() => rooms.value.length ? rooms.value : sampleEvents)
const selectedEvent = computed(() => dashboardRooms.value.find((room) => String(room.id) === selectedEventId.value) || dashboardRooms.value[0])
const selectedTheme = computed(() => eventPresentation(selectedEvent.value))
const displayCapacity = computed(() => eventCapacity(selectedEvent.value) || 80)
const demoMetrics = computed(() => {
  const total = displayCapacity.value
  const registered = Math.min(total, Math.round(total * .78))
  const arrived = Math.round(registered * .72)
  return { registered, arrived, waitlist: Math.round(total * .08), absent: registered - arrived, rate: Math.round(arrived / Math.max(1, registered) * 100) }
})
const attendees = computed(() => [
  { name: '陈同学', no: 'A-08', status: '已到场', time: '14:02' },
  { name: '林同学', no: 'A-09', status: '待核销', time: '—' },
  { name: '周同学', no: 'B-12', status: '已到场', time: '14:11' },
  { name: '许同学', no: 'B-15', status: '待核销', time: '—' }
].filter((person) => (attendeeFilter.value === '全部' || attendeeFilter.value === person.status) && `${person.name} ${person.no}`.includes(attendeeQuery.value.trim())))

function refreshDashboard() { dashboardUpdated.value = new Date() }
function exportAttendees() {
  const rows = [['姓名', '座位', '状态', '到场时间'], ...attendees.value.map((person) => [person.name, person.no, person.status, person.time])]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((row) => row.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = '活动名单演示.csv'
  link.click()
  URL.revokeObjectURL(url)
}
const roomDialog = ref(false)
const editingId = ref(null)
const roomForm = ref({
  name: '', location: '', open_time: '08:00', close_time: '22:00',
  seat_rows: 6, seat_cols: 8, description: ''
})

async function loadRooms() {
  try {
    const resp = await getRooms()
    rooms.value = resp.data || []
  } catch { rooms.value = [] }
  if (!dashboardRooms.value.some((room) => String(room.id) === selectedEventId.value)) selectedEventId.value = String(dashboardRooms.value[0]?.id || '')
}

function openCreate() {
  editingId.value = null
  roomForm.value = { name: '', location: '', open_time: '08:00', close_time: '22:00', seat_rows: 6, seat_cols: 8, description: '' }
  roomDialog.value = true
}
function openEdit(r) {
  editingId.value = r.id
  roomForm.value = {
    name: r.name, location: r.location,
    open_time: r.open_time.slice(0, 5), close_time: r.close_time.slice(0, 5),
    seat_rows: r.seat_rows, seat_cols: r.seat_cols, description: r.description
  }
  roomDialog.value = true
}
async function saveRoom() {
  const f = roomForm.value
  if (!f.name?.trim()) { message.warning('请输入活动名称'); return }
  if (editingId.value) { await updateRoom(editingId.value, f); message.success('活动已更新') }
  else {
    const resp = await createRoom(f)
    message.success(`活动已创建（ID=${resp.data.id}），可批量生成座位`)
  }
  roomDialog.value = false
  loadRooms()
}
async function onBatchGen(r) {
  try {
    await promptDialog(
      `按行列批量生成 ${r.name} 的座位（追加新座位，不覆盖现有）`,
      '批量生成座位',
      {
        inputValue: `${r.seat_rows} ${r.seat_cols}`,
        inputPattern: /^\s*\d{1,2}\s+\d{1,2}\s*$/,
        inputErrorMessage: '格式: 行 列（如 6 8）',
        confirmButtonText: '生成'
      }
    ).then(async ({ value }) => {
      const [rows, cols] = value.trim().split(/\s+/).map(Number)
      const resp = await batchGenSeats(r.id, { seat_rows: rows, seat_cols: cols })
      message.success(`已生成 ${resp.data.created} 个座位`)
      loadRooms()
    })
  } catch { /* 取消 */ }
}
async function onDeleteRoom(r) {
  try {
    await confirmDialog(
      `删除活动「${r.name}」将级联删除其全部座位与报名记录，确认？`,
      '危险操作', { type: 'warning', confirmButtonText: '确认删除' }
    )
  } catch { return }
  await deleteRoom(r.id)
  message.success('已删除')
  loadRooms()
}

// ---------- 座位维护 ----------
const seatDialog = ref(false)
const seatRoom = ref(null)
const seatList = ref([])
const seatLoading = ref(false)

const zoneName = { quiet: '观影区', regular: '宣讲区', discussion: '交流区', computer: '竞赛区' }

async function openSeats(r) {
  seatRoom.value = r
  seatDialog.value = true
  seatLoading.value = true
  const today = new Date().toISOString().slice(0, 10)
  try {
    const resp = await getSeatMap(r.id, today, '08:00', '22:00')
    seatList.value = resp.data.seats || []
  } finally {
    seatLoading.value = false
  }
}
async function toggleSeatStatus(s) {
  const next = s.status === 'available' ? 'maintenance' : 'available'
  await updateSeat(s.id, { zone: s.zone, has_power: s.has_power, near_window: s.near_window, status: next })
  s.status = next
  message.success(`${s.seat_no} 已${next === 'available' ? '恢复可用' : '进入维护'}`)
}

// ---------- 用户管理 ----------
const users = ref([])
async function loadUsers() {
  const resp = await listUsers()
  users.value = resp.data || []
}
async function toggleUser(u) {
  const next = u.status === 'active' ? 'disabled' : 'active'
  await setUserStatus(u.id, next)
  u.status = next
  message.success(`${u.username} 已${next === 'active' ? '启用' : '禁用'}`)
}

// ---------- 左栏统计 ----------
const userStats = ref({ total: 0, active: 0, disabled: 0, admin: 0, student: 0 })
function refreshStats() {
  const total = users.value.length || 0
  const active = users.value.filter((u) => u.status === 'active').length
  const disabled = total - active
  const admin = users.value.filter((u) => u.role === 'admin').length
  userStats.value = { total, active, disabled, admin, student: total - admin }
}
const roomStats = computed(() => ({
  total: rooms.value.length,
  seats: rooms.value.reduce((s, r) => s + (r.seat_rows * r.seat_cols || 0), 0)
}))
onMounted(async () => {
  await loadRooms()
  try { await loadUsers() } catch { users.value = [] }
  refreshStats()
})

const tabs = [
  { key: 'rooms', label: '活动管理', icon: 'building' },
  { key: 'users', label: '用户管理',   icon: 'users' }
]

function creditColor(s) {
  if (s < 60) return 'var(--red-strong)'
  if (s < 80) return 'var(--amber-strong)'
  return 'var(--green-strong)'
}
</script>

<template>
  <div v-reveal class="page-view">
    <header class="view-heading has-page-help"><div class="heading-copy" data-page-title>
      <h1>管理端</h1>
      <p class="heading-sub">活动、座位与用户的全局管理</p>
    </div><PageHelp title="管理须知"><ul class="tips">
          <li>批量生成座位会<b>追加</b>而非覆盖现有座位</li>
          <li>维护中座位学生端不可报名，不计入统计</li>
          <li>管理员账号<b>无法禁用</b>，防止误操作锁死</li>
        </ul></PageHelp></header>
    <section class="command-dashboard" :style="{ '--event-accent': selectedTheme.color }" aria-label="活动运营演示看板">
      <div class="command-head"><div><span class="command-kicker">ACTIVITY CONTROL / 运营看板</span><h2>{{ selectedEvent?.name || '校园活动' }}</h2><p>{{ selectedEvent?.location }} · {{ selectedTheme.category }} · 展示指标</p></div><div class="command-actions"><label>当前活动<select v-model="selectedEventId"><option v-for="room in dashboardRooms" :key="room.id" :value="String(room.id)">{{ room.name }}</option></select></label><button @click="refreshDashboard"><AppIcon name="refresh" :size="16" />刷新</button></div></div>
      <div class="command-metrics"><div><span>实时报名</span><strong>{{ demoMetrics.registered }}</strong><small>演示数据</small></div><div><span>已到场</span><strong>{{ demoMetrics.arrived }}</strong><small>演示数据</small></div><div><span>到场率</span><strong>{{ demoMetrics.rate }}%</strong><small>演示数据</small></div><div><span>候补人数</span><strong>{{ demoMetrics.waitlist }}</strong><small>演示数据</small></div><div><span>未到人数</span><strong>{{ demoMetrics.absent }}</strong><small>演示数据</small></div></div>
      <div class="command-lower"><div class="arrival-ring" :style="{ '--rate': `${demoMetrics.rate}%` }"><div><strong>{{ demoMetrics.rate }}%</strong><span>到场率</span></div></div><div class="command-bars"><div><span>普通观众</span><div><i style="width:72%; background:#2563eb" /></div><b>72%</b></div><div><span>嘉宾</span><div><i style="width:86%; background:#8b5cf6" /></div><b>86%</b></div><div><span>工作人员</span><div><i style="width:94%; background:#06b6d4" /></div><b>94%</b></div><div><span>媒体</span><div><i style="width:58%; background:#f59e0b" /></div><b>58%</b></div><div><span>无障碍</span><div><i style="width:50%; background:#22c55e" /></div><b>50%</b></div></div><div class="command-note"><span class="host-mark">{{ selectedTheme.symbol }}</span><strong>{{ selectedTheme.host }}</strong><p>分区到场率为界面示意。活动、座位和用户管理仍使用现有服务数据。</p><small>最后刷新：{{ dashboardUpdated.toLocaleTimeString('zh-CN', { hour12: false }) }}</small></div></div>
    </section>
    <section class="attendee-preview"><div class="attendee-top"><div><h2>现场名单</h2><p>演示名单 · 未到人员优先显示</p></div><div><input v-model="attendeeQuery" type="search" aria-label="搜索名单" placeholder="搜索姓名或座位" /><select v-model="attendeeFilter" aria-label="筛选到场状态"><option>全部</option><option>已到场</option><option>待核销</option></select><button @click="exportAttendees"><AppIcon name="reservations" :size="16" />导出</button></div></div><div class="attendee-list"><div v-for="person in attendees" :key="person.no"><span>{{ person.name }}</span><span>{{ person.no }}</span><span :class="person.status === '已到场' ? 'arrived' : 'pending'">{{ person.status }}</span><time>{{ person.time }}</time></div><p v-if="!attendees.length">没有符合筛选条件的人员</p></div></section>
    <div class="split admin-split">
    <!-- 左栏：导航 + 统计 + 快速操作 -->
    <div class="split-left">
      <section class="card responsive-compact">
        <div class="card-title-row">
          <h3>管理面板</h3>
          <STag type="danger">管理员</STag>
        </div>
        <nav v-active-track class="side-nav">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="side-nav-item"
            :class="{ active: activeTab === t.key }"
            @click="activeTab = t.key"
          >
            <span class="side-nav-icon"><AppIcon :name="t.icon" :size="17" /></span>
            <span class="side-nav-label">{{ t.label }}</span>
          </button>
        </nav>
      </section>

      <section class="card responsive-compact">
        <div class="card-title-row"><h3>运营统计</h3></div>
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-num">{{ roomStats.total }}</div>
            <div class="kpi-label">活动数量</div>
          </div>
          <div class="kpi">
            <div class="kpi-num">{{ roomStats.seats }}</div>
            <div class="kpi-label">座位规模</div>
          </div>
          <div class="kpi">
            <div class="kpi-num">{{ userStats.total }}</div>
            <div class="kpi-label">注册用户</div>
          </div>
          <div class="kpi kpi-bad">
            <div class="kpi-num">{{ userStats.disabled }}</div>
            <div class="kpi-label">已禁用</div>
          </div>
        </div>
      </section>

      <section class="card responsive-compact">
        <h3>快速操作</h3>
        <div class="quick-actions">
          <SButton v-if="activeTab === 'rooms'" variant="primary" block @click="openCreate">
            <AppIcon name="add" :size="16" />新建活动
          </SButton>
          <SButton variant="secondary" block @click="loadRooms(); loadUsers(); refreshStats()">
            <AppIcon name="refresh" :size="16" />刷新数据
          </SButton>
        </div>
        
      </section>
    </div>

    <!-- 右栏：活动 / 用户 表格 -->
    <div class="split-right">
      <!-- 活动管理 -->
      <section v-if="activeTab === 'rooms'" class="card">
        <div class="card-title-row">
          <h3>活动管理</h3>
          <SButton variant="primary" size="sm" @click="openCreate">新建活动</SButton>
        </div>
        <div class="table-wrap">
          <div class="table-scroll" tabindex="0" aria-label="活动管理表格，可左右滑动">
            <table class="table rooms-table">
              <thead>
                <tr>
                  <th style="width:46px" class="num-col">ID</th>
                  <th style="width:132px">名称</th>
                  <th style="width:124px">位置</th>
                  <th style="width:108px">活动时段</th>
                  <th style="width:64px">规模</th>
                  <th style="width:286px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rooms" :key="row.id">
                  <td class="num cell-dim num-col">{{ row.id }}</td>
                  <td class="cell-strong ellip">{{ row.name }}</td>
                  <td class="ellip">{{ row.location }}</td>
                  <td class="num">{{ row.open_time.slice(0, 5) }} – {{ row.close_time.slice(0, 5) }}</td>
                  <td class="num">{{ row.seat_rows }} × {{ row.seat_cols }}</td>
                  <td>
                    <span class="row-actions">
                      <SButton size="sm" variant="soft" @click="openEdit(row)">编辑</SButton>
                      <SButton size="sm" variant="soft" @click="onBatchGen(row)">生成座位</SButton>
                      <SButton size="sm" variant="soft" @click="openSeats(row)">座位维护</SButton>
                      <SButton size="sm" variant="soft-danger" @click="onDeleteRoom(row)">删除</SButton>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <SEmpty v-if="!rooms.length" description="暂无活动，点击右上角新建" />
          </div>
        </div>
      </section>

      <!-- 用户管理 -->
      <section v-if="activeTab === 'users'" class="card">
        <div class="card-title-row">
          <h3>用户管理</h3>
          <SButton variant="secondary" size="sm" @click="loadUsers(); refreshStats()">
            <AppIcon name="refresh" :size="14" />刷新
          </SButton>
        </div>
        <div class="table-wrap">
          <div class="table-scroll" tabindex="0" aria-label="用户管理表格，可左右滑动">
            <table class="table users-table">
              <thead>
                <tr>
                  <th style="width:44px" class="num-col">ID</th>
                  <th style="width:108px">用户名</th>
                  <th style="width:96px">姓名</th>
                  <th style="width:112px">学号</th>
                  <th style="width:88px">角色</th>
                  <th style="width:88px">信用分</th>
                  <th style="width:90px">状态</th>
                  <th style="width:96px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in users" :key="row.id">
                  <td class="num cell-dim num-col">{{ row.id }}</td>
                  <td class="cell-strong">{{ row.username }}</td>
                  <td>{{ row.real_name }}</td>
                  <td class="num">{{ row.student_no }}</td>
                  <td>
                    <STag :type="row.role === 'admin' ? 'danger' : 'primary'">
                      {{ row.role === 'admin' ? '管理员' : '学生' }}
                    </STag>
                  </td>
                  <td class="num-col">
                    <span class="credit-num" :style="{ color: creditColor(row.credit_score) }">
                      {{ row.credit_score }}
                    </span>
                  </td>
                  <td>
                    <STag :type="row.status === 'active' ? 'success' : 'neutral'" dot>
                      {{ row.status === 'active' ? '正常' : '禁用' }}
                    </STag>
                  </td>
                  <td>
                    <SButton
                      v-if="row.role !== 'admin'"
                      size="sm"
                      :variant="row.status === 'active' ? 'soft-danger' : 'soft-success'"
                      @click="toggleUser(row)"
                    >
                      {{ row.status === 'active' ? '禁用' : '启用' }}
                    </SButton>
                    <span v-else class="cell-dim">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <SEmpty v-if="!users.length" description="暂无用户" />
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- =============== 活动场地编辑弹框 =============== -->
  <SDialog v-model="roomDialog" :title="editingId ? '编辑活动' : '新建活动'" width="540px">
    <div class="dialog-form">
      <div class="dialog-field">
        <label class="dialog-label">名称 <span class="req">*</span></label>
        <SInput v-model="roomForm.name" placeholder="如 观影分享会、校园招聘宣讲会、计算机竞赛" />
      </div>
      <div class="dialog-field">
        <label class="dialog-label">位置</label>
        <SInput v-model="roomForm.location" placeholder="如 学生活动中心一楼报告厅" />
      </div>
      <div class="dialog-field">
        <label class="dialog-label">活动时段</label>
        <div class="time-range">
          <SSelect v-model="roomForm.open_time" :options="openTimeOptions" />
          <span class="time-arrow">至</span>
          <SSelect v-model="roomForm.close_time" :options="closeTimeOptions" />
        </div>
      </div>
      <div class="dialog-field">
        <label class="dialog-label">座位布局</label>
        <div class="scale-range">
          <SInputNumber v-model="roomForm.seat_rows" :min="1" :max="30" />
          <span class="scale-x">行</span>
          <SInputNumber v-model="roomForm.seat_cols" :min="1" :max="30" />
          <span class="scale-x">列</span>
        </div>
      </div>
      <div class="dialog-field">
        <label class="dialog-label">说明</label>
        <SInput v-model="roomForm.description" type="textarea" :rows="2" placeholder="活动内容、参与要求、设备支持等（选填）" />
      </div>
    </div>
    <template #footer>
      <SButton variant="secondary" @click="roomDialog = false">取消</SButton>
      <SButton variant="primary" @click="saveRoom">保存</SButton>
    </template>
  </SDialog>

  <!-- =============== 座位维护弹框 =============== -->
  <SDialog v-model="seatDialog" :title="`座位维护 - ${seatRoom?.name || ''}`" width="820px">
    <div class="seat-tip">
      <span class="seat-tip-icon"><AppIcon name="info" :size="17" /></span>
      <span>点击右侧按钮切换座位状态，<b>维护中</b>的座位在学生端不可报名。</span>
    </div>
    <div class="table-wrap">
      <div class="table-scroll" v-loading="seatLoading" tabindex="0" aria-label="座位维护表格，可左右滑动">
        <table class="table seats-table">
          <thead>
            <tr>
              <th style="width:90px">座位号</th>
              <th style="width:90px">坐标</th>
              <th style="width:110px">区域</th>
              <th style="width:72px">电源</th>
              <th style="width:72px">靠窗</th>
              <th style="width:104px">状态</th>
              <th style="width:120px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in seatList" :key="row.id">
              <td class="cell-strong num num-col">{{ row.seat_no }}</td>
              <td class="num num-col">{{ row.row_no }}, {{ row.col_no }}</td>
              <td><span class="zone-chip">{{ zoneName[row.zone] || row.zone }}</span></td>
              <td>
                <span v-if="row.has_power" class="chip-ok"><AppIcon name="check" :size="15" /></span>
                <span v-else class="cell-dim">—</span>
              </td>
              <td>
                <span v-if="row.near_window" class="chip-ok"><AppIcon name="check" :size="15" /></span>
                <span v-else class="cell-dim">—</span>
              </td>
              <td>
                <STag :type="row.status === 'available' ? 'success' : 'warning'" dot>
                  {{ row.status === 'available' ? '可用' : '维护' }}
                </STag>
              </td>
              <td>
                <SButton
                  size="sm"
                  :variant="row.status === 'available' ? 'soft-warn' : 'soft-success'"
                  @click="toggleSeatStatus(row)"
                >
                  {{ row.status === 'available' ? '设为维护' : '恢复可用' }}
                </SButton>
              </td>
            </tr>
          </tbody>
        </table>
        <SEmpty v-if="!seatList.length && !seatLoading" description="该活动暂无座位" />
      </div>
    </div>
    <template #footer>
      <SButton variant="secondary" @click="seatDialog = false">关闭</SButton>
    </template>
  </SDialog>
  </div>
</template>

<style scoped>

.rooms-table { min-width: 760px; }
.users-table { min-width: 770px; }
.seats-table { min-width: 620px; }

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
  margin-top: 2px;
}

.num-col {
  text-align: center;
}

.credit-num {
  font-weight: 700;
  font-size: var(--fs-body);
  font-variant-numeric: tabular-nums;
}

.zone-chip {
  display: inline-block;
  padding: 2px 9px;
  background: var(--surface-3);
  color: var(--text-3);
  border-radius: var(--r-sm);
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
}

.rooms-table .row-actions {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.chip-ok {
  color: var(--green);
  display: inline-grid;
  place-items: center;
}

/* 弹窗表单 */
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.dialog-label {
  font-size: var(--fs-caption);
  color: var(--text-3);
  font-weight: 600;
  letter-spacing: .03em;
}
.dialog-label .req {
  color: var(--red);
}
.time-range {
  display: flex;
  align-items: center;
  gap: 10px;
}
.time-arrow {
  color: var(--text-4);
  font-size: var(--fs-body-sm);
  flex: 0 0 auto;
}
.scale-range {
  display: flex;
  align-items: center;
  gap: 8px;
}
.scale-x {
  color: var(--text-4);
  font-size: var(--fs-body-sm);
  margin-right: 8px;
}

/* 座位提示条 */
.seat-tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--primary-faint);
  border: 1px solid #dfe8fb;
  color: var(--text-2);
  padding: 10px 14px;
  border-radius: var(--r-lg);
  margin-bottom: 14px;
  font-size: var(--fs-body-sm);
  line-height: 1.6;
}
.seat-tip-icon {
  color: var(--primary);
  flex: 0 0 auto;
  margin-top: 2px;
}
.seat-tip b {
  color: var(--primary-active);
  font-weight: 600;
}

@media (max-width: 720px) {
  .time-range,
  .scale-range {
    align-items: stretch;
    flex-direction: column;
  }
  .time-arrow,
  .scale-x {
    margin: 0;
    text-align: center;
  }
  .seat-tip {
    padding: 10px 12px;
  }
}
</style>
