<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../../components/AppIcon.vue'

const code = ref('')
const result = ref(null)
const history = ref([])
const filter = ref('全部')
const demoCode = 'CAMPUS-2026'
const visibleHistory = computed(() => history.value.filter((entry) => filter.value === '全部' || entry.status === filter.value))

function verify() {
  const value = code.value.trim().toUpperCase()
  if (!value) { result.value = { status: 'error', title: '请输入报名码', detail: '请核对报名凭证上的编号。' }; return }
  const used = history.value.some((entry) => entry.code === value && entry.status === '成功')
  result.value = value === demoCode && !used
    ? { status: 'success', title: '核销成功', detail: '演示参与者 · 观影分享会 · A-08 座位' }
    : { status: 'error', title: used ? '此码已核销' : '未找到报名信息', detail: used ? '请勿重复检票。' : '请核对编号后重试，或联系现场管理员。' }
  history.value.unshift({ code: value, status: result.value.status === 'success' ? '成功' : '失败', time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) })
  code.value = ''
}

function exportHistory() {
  const rows = [['时间', '报名码', '结果'], ...history.value.map((row) => [row.time, row.code, row.status])]
  const csv = '\uFEFF' + rows.map((row) => row.join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '核销演示记录.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="page-view checkin-page">
    <header class="view-heading" data-page-title><h1>现场核销演示</h1><p class="heading-sub">演示模式 · 手动输入报名码，结果仅保存在本页</p></header>
    <div class="checkin-grid">
      <section class="checkin-panel"><div class="checkin-mode"><span class="live-dot" />观影分享会 · 入场口 A</div><h2>输入报名码</h2><p>演示码：<strong>{{ demoCode }}</strong></p><form @submit.prevent="verify"><label for="checkin-code">报名凭证编号</label><input id="checkin-code" v-model="code" autocomplete="off" spellcheck="false" placeholder="例如 CAMPUS-2026" /><button type="submit"><AppIcon name="check" :size="20" />确认核销</button></form><div class="checkin-help"><AppIcon name="info" :size="17" />扫码设备接入后可在此接收扫码结果；当前仅演示手动核验。</div></section>
      <section class="checkin-result" :class="result?.status || 'idle'" role="status" aria-live="polite"><div class="result-symbol"><AppIcon :name="result?.status === 'error' ? 'warning' : 'check'" :size="52" /></div><span class="result-kicker">核销结果</span><h2>{{ result?.title || '等待核销' }}</h2><p>{{ result?.detail || '输入报名码后，在这里查看清晰的检票结果。' }}</p><button v-if="result" @click="result = null">继续核销</button></section>
    </div>
    <section class="checkin-log"><div class="checkin-log-head"><div><h2>本页核销记录</h2><span>{{ history.length }} 条演示记录</span></div><div class="checkin-log-tools"><div class="mini-segment" role="group" aria-label="筛选核销结果"><button v-for="item in ['全部', '成功', '失败']" :key="item" :class="{ active: filter === item }" @click="filter = item">{{ item }}</button></div><button :disabled="!history.length" @click="exportHistory"><AppIcon name="reservations" :size="16" />导出</button></div></div><div v-if="!visibleHistory.length" class="hall-empty">暂无核销记录</div><div v-else class="checkin-log-list"><div v-for="(entry, index) in visibleHistory" :key="`${entry.time}-${index}`"><time>{{ entry.time }}</time><strong>{{ entry.code }}</strong><span :class="entry.status === '成功' ? 'ok' : 'fail'">{{ entry.status }}</span></div></div></section>
  </div>
</template>
