<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from '../components/ui/feedback'
import { login, register } from '../api/auth'
import { useAuthStore } from '../stores/auth'
import AppIcon from '../components/AppIcon.vue'
import SButton from '../components/ui/SButton.vue'
import SInput from '../components/ui/SInput.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const mode = ref('login') // login | register
const loading = ref(false)
const loginSuccess = ref(false)
const shellRef = ref(null)
const activeBadge = ref(0)
const activityBadges = [
  { label: '讲座', icon: 'announcement', description: '听见新的观点，预留一席好位置。' },
  { label: '演出', icon: 'ticket', description: '从报名到入场，让精彩自然发生。' },
  { label: '比赛', icon: 'desk-pc', description: '与同伴并肩，在赛场上尽情发挥。' },
  { label: '户外', icon: 'sun', description: '走出教室，一起发现校园的新鲜事。' },
  { label: '志愿', icon: 'users', description: '让每一次参与，都留下温暖的回响。' }
]
const currentActivity = computed(() => activityBadges[activeBadge.value])
let badgeTimer
let motionMedia
let parallaxMedia
let motionFrame

function stopBadgeRotation() {
  window.clearInterval(badgeTimer)
  badgeTimer = undefined
}

function startBadgeRotation() {
  stopBadgeRotation()
  if (motionMedia?.matches) return
  badgeTimer = window.setInterval(() => {
    activeBadge.value = (activeBadge.value + 1) % activityBadges.length
  }, 3000)
}

function onMotionPreferenceChange() {
  startBadgeRotation()
  if (motionMedia?.matches) resetParallax()
}

function resetParallax() {
  if (motionFrame) cancelAnimationFrame(motionFrame)
  motionFrame = undefined
  shellRef.value?.style.setProperty('--parallax-x', '0px')
  shellRef.value?.style.setProperty('--parallax-y', '0px')
}

function onPointerMove(event) {
  if (motionMedia?.matches || !parallaxMedia?.matches) return
  if (motionFrame) cancelAnimationFrame(motionFrame)
  motionFrame = requestAnimationFrame(() => {
    const width = shellRef.value?.clientWidth || window.innerWidth
    const height = shellRef.value?.clientHeight || window.innerHeight
    shellRef.value?.style.setProperty('--parallax-x', `${((0.5 - event.clientX / width) * 10).toFixed(1)}px`)
    shellRef.value?.style.setProperty('--parallax-y', `${((0.5 - event.clientY / height) * 10).toFixed(1)}px`)
    motionFrame = undefined
  })
}

onMounted(() => {
  motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  parallaxMedia = window.matchMedia('(min-width: 921px) and (hover: hover) and (pointer: fine)')
  motionMedia.addEventListener('change', onMotionPreferenceChange)
  parallaxMedia.addEventListener('change', resetParallax)
  startBadgeRotation()
})

onUnmounted(() => {
  stopBadgeRotation()
  motionMedia?.removeEventListener('change', onMotionPreferenceChange)
  parallaxMedia?.removeEventListener('change', resetParallax)
  if (motionFrame) cancelAnimationFrame(motionFrame)
})

const loginForm = reactive({ username: 'stu01', password: '123456' })
const regForm = reactive({ username: '', password: '', confirm: '', real_name: '', student_no: '' })

async function onLogin() {
  if (!loginForm.username || !loginForm.password) {
    message.warning('请输入用户名与口令')
    return
  }
  loading.value = true
  try {
    const resp = await login(loginForm)
    auth.setLogin(resp.data)
    loginSuccess.value = true
    await new Promise((resolve) => window.setTimeout(resolve, 500))
    await router.push(route.query.redirect || '/')
  } finally {
    loading.value = false
    loginSuccess.value = false
  }
}

async function onRegister() {
  const f = regForm
  if (!f.username || !f.password || !f.real_name) {
    message.warning('请完整填写必填项')
    return
  }
  if (f.password.length < 6) {
    message.warning('口令至少 6 位')
    return
  }
  if (f.password !== f.confirm) {
    message.warning('两次输入的口令不一致')
    return
  }
  loading.value = true
  try {
    await register({
      username: f.username,
      password: f.password,
      real_name: f.real_name,
      student_no: f.student_no
    })
    message.success('注册成功，请登录')
    loginForm.username = f.username
    mode.value = 'login'
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <div ref="shellRef" class="auth-shell" @pointermove="onPointerMove" @pointerleave="resetParallax">
    <div class="auth-atmosphere" aria-hidden="true">
      <div class="light-layer light-layer--blue"><span class="light-spot" /></div>
      <div class="light-layer light-layer--cyan"><span class="light-spot" /></div>
      <div class="light-layer light-layer--violet"><span class="light-spot" /></div>
      <div class="seat-grid" />
      <div class="zone-points">
        <span v-for="n in 8" :key="n" class="zone-point" :class="`zone-point--${n}`" />
      </div>
    </div>

    <aside class="auth-hero">
      <div class="hero-brand">
        <div class="hero-mark"><AppIcon name="ticket" :size="22" /></div>
        <div>
          <div class="hero-name">校园活动报名与签到核销系统</div>
          <div class="hero-sub">CAMPUS EVENTS</div>
        </div>
      </div>

      <div class="hero-body">
        <h1 class="hero-title">让每一次活动<br />都有理想的位置</h1>
        <p class="hero-desc">发现活动 · 选好座位 · 扫码入场</p>
        <div class="activity-spotlight">
          <div
            class="activity-badges"
            role="group"
            aria-label="活动类型"
            @pointerenter="stopBadgeRotation"
            @pointerleave="startBadgeRotation"
            @focusin="stopBadgeRotation"
            @focusout="startBadgeRotation"
          >
            <button
              v-for="(badge, index) in activityBadges"
              :key="badge.label"
              type="button"
              class="activity-badge"
              :class="{ 'is-active': activeBadge === index }"
              :aria-pressed="activeBadge === index"
              @click="activeBadge = index"
            >
              <AppIcon :name="badge.icon" :size="16" />
              {{ badge.label }}
            </button>
          </div>
          <Transition name="badge-copy" mode="out-in">
            <p :key="currentActivity.label" class="activity-copy">{{ currentActivity.description }}</p>
          </Transition>
        </div>
      </div>

      <div class="hero-foot">支持分区选座 · 无障碍座位 · 动态二维码核销</div>
    </aside>

    <main class="auth-panel">
      <div class="auth-card"><header class="auth-heading"><h2>{{ mode === 'login' ? '欢迎回来' : '开启校园活动之旅' }}</h2><p>报名校园活动，签到记录每一次参与。</p></header>
        <div v-active-track class="seg seg-block" role="tablist" aria-label="登录或注册">
          <button
            class="seg-btn"
            role="tab"
            :class="{ active: mode === 'login' }"
            :aria-selected="mode === 'login'"
            @click="mode = 'login'"
          >
            登录
          </button>
          <button
            class="seg-btn"
            role="tab"
            :class="{ active: mode === 'register' }"
            :aria-selected="mode === 'register'"
            @click="mode = 'register'"
          >
            注册
          </button>
        </div>

        <form v-if="mode === 'login'" class="auth-form" @submit.prevent="onLogin">
          <div class="form-field">
            <label class="form-label" for="login-username">用户名</label>
            <SInput id="login-username" v-model="loginForm.username" size="lg" placeholder="用户名" autocomplete="username" />
          </div>
          <div class="form-field">
            <label class="form-label" for="login-password">口令</label>
            <SInput
              id="login-password"
              v-model="loginForm.password"
              type="password"
              size="lg"
              placeholder="口令"
              show-password
              autocomplete="current-password"
              @keyup.enter="onLogin"
            />
          </div>
          <SButton type="submit" variant="primary" size="lg" block :loading="loading">
            登录
          </SButton>
        </form>

        <form v-else class="auth-form" @submit.prevent="onRegister">
          <div class="form-field">
            <label class="form-label" for="reg-username">用户名</label>
            <SInput id="reg-username" v-model="regForm.username" size="lg" placeholder="用户名（≥3 位）" autocomplete="username" />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-realname">真实姓名</label>
            <SInput id="reg-realname" v-model="regForm.real_name" size="lg" placeholder="真实姓名" />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-studentno">学号（选填）</label>
            <SInput id="reg-studentno" v-model="regForm.student_no" size="lg" placeholder="学号（选填）" />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-password">口令</label>
            <SInput id="reg-password" v-model="regForm.password" type="password" size="lg" placeholder="口令（≥6 位）" show-password autocomplete="new-password" />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-confirm">确认口令</label>
            <SInput id="reg-confirm" v-model="regForm.confirm" type="password" size="lg" placeholder="再次输入口令" show-password autocomplete="new-password" />
          </div>
          <SButton type="submit" variant="primary" size="lg" block :loading="loading">
            注册
          </SButton>
        </form>

        <p class="auth-tip">
          演示账号：stu01 / 123456 · 管理员：admin / admin123
        </p>
        <Transition name="success-state">
          <div v-if="loginSuccess" class="auth-success" role="status">
            <AppIcon name="circle-success" :size="42" />
            <strong>登录成功</strong>
            <span>正在进入活动大厅</span>
          </div>
        </Transition>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-shell {
  --canvas: #f6f8fb;
  --surface: #fff;
  --surface-3: #f1f4f9;
  --border: #e4e8f0;
  --border-strong: #cbd6e6;
  --hairline: #e9eef6;
  --text-1: #17253b;
  --text-2: #40516b;
  --text-3: #63748e;
  --text-4: #71829b;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-active: #1e40af;
  --primary-weak: #dbeafe;
  --primary-ring: rgba(37, 99, 235, .2);
  --green-strong: #15803d;
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 55%) minmax(0, 45%);
  background: #f6f8fb;
  overflow: hidden;
}

.auth-atmosphere {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.auth-atmosphere::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 25%, rgba(246, 248, 251, .28) 55%, rgba(246, 248, 251, .68) 100%);
}

.light-layer {
  position: absolute;
  width: min(74vw, 930px);
  aspect-ratio: 1;
  transform: translate3d(var(--parallax-x, 0px), var(--parallax-y, 0px), 0);
  transition: transform .25s ease-out;
}

.light-spot {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  filter: blur(72px);
  animation: light-drift var(--light-duration) ease-in-out infinite alternate;
}

.light-layer--blue { top: -39%; left: -23%; --light-duration: 28s; }
.light-layer--blue .light-spot { background: #80aeff; opacity: .52; }
.light-layer--cyan { right: -23%; bottom: -56%; --light-duration: 34s; }
.light-layer--cyan .light-spot { background: #7ddfe7; opacity: .45; }
.light-layer--violet { top: 13%; left: 43%; width: min(55vw, 700px); --light-duration: 40s; }
.light-layer--violet .light-spot { background: #b6a5fa; opacity: .35; }

.seat-grid {
  position: absolute;
  inset: 12% 29% 8% 3%;
  background-image:
    linear-gradient(rgba(37, 99, 235, .1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, .1) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(ellipse at 46% 50%, #000 6%, transparent 74%);
  transform: rotate(-10deg);
}

.seat-grid::after {
  content: '';
  position: absolute;
  inset: -50%;
  background: linear-gradient(135deg, transparent 43%, rgba(255, 255, 255, .48) 50%, transparent 57%);
  transform: translate(-65%, -65%);
  animation: grid-sweep 20s linear infinite;
}

.zone-points { position: absolute; inset: 0; }
.zone-point {
  position: absolute;
  top: var(--point-top);
  left: var(--point-left);
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--point-color);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--point-color) 15%, transparent);
  opacity: .72;
  animation: point-float var(--point-duration) ease-in-out infinite alternate;
  animation-delay: var(--point-delay, 0s);
}
.zone-point--1 { --point-top: 26%; --point-left: 13%; --point-color: #2563eb; --point-duration: 8s; }
.zone-point--2 { --point-top: 44%; --point-left: 30%; --point-color: #8b5cf6; --point-duration: 9s; --point-delay: -2s; }
.zone-point--3 { --point-top: 67%; --point-left: 19%; --point-color: #06b6d4; --point-duration: 10s; --point-delay: -4s; }
.zone-point--4 { --point-top: 32%; --point-left: 45%; --point-color: #22c55e; --point-duration: 11s; --point-delay: -5s; }
.zone-point--5 { --point-top: 72%; --point-left: 46%; --point-color: #2563eb; --point-duration: 12s; --point-delay: -2s; }
.zone-point--6 { --point-top: 53%; --point-left: 58%; --point-color: #8b5cf6; --point-duration: 9s; --point-delay: -6s; }
.zone-point--7 { --point-top: 20%; --point-left: 65%; --point-color: #06b6d4; --point-duration: 10s; --point-delay: -3s; }
.zone-point--8 { --point-top: 80%; --point-left: 69%; --point-color: #22c55e; --point-duration: 11s; --point-delay: -7s; }

@keyframes light-drift {
  from { transform: translate3d(-2%, 1%, 0) scale(.96); }
  to { transform: translate3d(4%, -3%, 0) scale(1.06); }
}
@keyframes grid-sweep {
  to { transform: translate(65%, 65%); }
}
@keyframes point-float {
  from { transform: translateY(4px) scale(.85); opacity: .48; }
  to { transform: translateY(-5px) scale(1.12); opacity: .8; }
}

/* ============ 左侧品牌区 ============ */
.auth-shell .auth-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100dvh;
  padding: 46px clamp(36px, 5vw, 82px) 32px;
  background: transparent;
  border-right: 1px solid rgba(255, 255, 255, .55);
}

.auth-hero::before {
  display: none;
}

.hero-brand {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-mark {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 12px;
  background: var(--primary);
  color: #fff;
  display: grid;
  place-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .18), 0 4px 12px rgba(59, 102, 218, .32);
}

.hero-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.4;
}

.hero-sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 3px;
}

.hero-body {
  position: relative;
  width: 100%;
  max-width: 600px;
  padding: 34px 0;
}

.auth-shell .hero-title {
  font-size: 48px;
  line-height: 1.22;
  font-weight: 650;
  letter-spacing: 0;
  color: var(--text-1);
}

.hero-desc {
  margin-top: 18px;
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-2);
}

.activity-spotlight { margin-top: 38px; }
.activity-badges { display: flex; flex-wrap: wrap; gap: 9px; }
.activity-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, .7);
  border-radius: 8px;
  background: rgba(255, 255, 255, .42);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  opacity: .68;
  backdrop-filter: blur(8px);
  transition: opacity .4s ease, transform .4s ease, background .4s ease, border-color .4s ease, box-shadow .4s ease, color .4s ease;
}
.activity-badge:hover,
.activity-badge:focus-visible { opacity: 1; border-color: #8eb4fa; background: rgba(255, 255, 255, .85); }
.activity-badge:focus-visible { outline: 3px solid var(--primary-ring); outline-offset: 2px; }
.activity-badge.is-active {
  opacity: 1;
  transform: translateY(-3px);
  background: rgba(255, 255, 255, .92);
  border-color: rgba(37, 99, 235, .3);
  color: #1d4ed8;
  box-shadow: 0 7px 18px rgba(37, 99, 235, .12);
}
.activity-copy {
  min-height: 24px;
  margin-top: 18px;
  color: var(--text-2);
  font-size: 14px;
  line-height: 24px;
}
.badge-copy-enter-active,
.badge-copy-leave-active { transition: opacity .2s ease, transform .2s ease; }
.badge-copy-enter-from { opacity: 0; transform: translateY(4px); }
.badge-copy-leave-to { opacity: 0; transform: translateY(-4px); }

.hero-foot {
  position: relative;
  color: var(--text-3);
  font-size: 12px;
}

/* ============ 右侧表单区 ============ */
.auth-shell .auth-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 32px 30px;
  background: transparent;
  overflow: visible;
}

.auth-card {
  position: relative;
  width: 420px;
  max-width: 100%;
  padding: 36px 36px 30px;
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: 16px;
  background: rgba(255, 255, 255, .82);
  box-shadow: 0 20px 55px rgba(28, 69, 130, .13), 0 2px 12px rgba(28, 69, 130, .05);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  animation: card-arrive .3s ease-out both;
}

@keyframes card-arrive {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.auth-heading { margin-bottom: 22px; }
.auth-heading h2 { color: var(--text-1); font-size: 25px; line-height: 1.3; }
.auth-heading p { color: var(--text-2); line-height: 1.6; }
.auth-card .seg { background: rgba(237, 243, 253, .9); }
.auth-card .seg-btn { min-height: 42px; }
.auth-card .seg-btn.active { color: var(--primary-active); }
.auth-card :deep(.active-track) { background: #fff; }

.auth-success {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: inherit;
  background: rgba(255, 255, 255, .96);
  color: var(--green-strong);
  text-align: center;
  backdrop-filter: blur(14px);
}
.auth-success strong { color: var(--text-1); font-size: 20px; }
.auth-success span { color: var(--text-2); font-size: 14px; }
.success-state-enter-active { transition: opacity .2s ease; }
.success-state-enter-from { opacity: 0; }

.auth-form :deep(.s-input) {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(255, 255, 255, .91);
  transition: border-color .18s ease, box-shadow .18s ease;
}
.auth-form :deep(.s-input.is-focused) { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.auth-form :deep(.s-btn--primary) {
  overflow: hidden;
  border-radius: 10px;
  font-weight: 600;
}
.auth-form :deep(.s-btn--primary)::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, .33) 50%, transparent 70%);
  transform: translateX(-150%);
  pointer-events: none;
}
.auth-form :deep(.s-btn--primary:hover:not(:disabled))::after { animation: button-sheen .6s ease-out; }
@keyframes button-sheen { to { transform: translateX(150%); } }

.form-field {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.form-field::after {
  content: '';
  position: absolute;
  z-index: 1;
  right: 10px;
  bottom: 1px;
  left: 10px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, #2563eb, #06b6d4);
  transform: scaleX(0);
  transform-origin: center;
  transition: transform .18s ease;
  pointer-events: none;
}
.form-field:focus-within::after { transform: scaleX(1); }

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 22px;
}

.form-label {
  font-size: var(--fs-caption);
  font-weight: 600;
  color: var(--text-2);
  letter-spacing: 0;
}

.auth-form .s-btn {
  margin-top: 6px;
}

.auth-tip {
  margin-top: 18px;
  font-size: var(--fs-caption);
  color: var(--text-3);
  text-align: center;
  line-height: 1.7;
  padding-top: 16px;
  border-top: 1px solid var(--hairline);
}

@media (max-width: 1150px) and (min-width: 921px) {
  .auth-shell .hero-title { font-size: 40px; }
  .activity-badge { padding: 0 10px; }
  .auth-card { padding: 30px 28px 25px; }
}

/* ============ 响应式 ============ */
@media (max-width: 920px) {
  .auth-shell {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(230px, 35dvh) minmax(0, 1fr);
  }
  .auth-shell .auth-hero {
    display: flex;
    min-height: 0;
    padding: 24px 24px 28px;
    border-right: 0;
    background: linear-gradient(145deg, rgba(219, 234, 254, .3), rgba(207, 250, 254, .13));
  }
  .auth-shell .hero-title { font-size: 30px; }
  .hero-body { padding: 12px 0 0; }
  .hero-desc { margin-top: 6px; font-size: 13px; }
  .activity-spotlight,
  .hero-foot,
  .light-layer--violet,
  .zone-point:nth-child(n+5) { display: none; }
  .seat-grid { inset: 0 0 42% 0; opacity: .35; }
  .light-layer { width: 110vw; }
  .light-layer--blue { top: -32%; left: -54%; }
  .light-layer--cyan { right: -54%; bottom: 15%; }
  .auth-atmosphere::after { background: linear-gradient(to bottom, transparent 0%, rgba(246, 248, 251, .72) 43%, #f6f8fb 75%); }
  .auth-shell .auth-panel {
    min-height: 0;
    align-items: flex-start;
    padding: 0 20px 36px;
  }
  .auth-card {
    margin-top: -13px;
    padding: 30px 28px 24px;
    background: rgba(255, 255, 255, .95);
  }
}

@media (max-width: 480px) {
  .auth-shell .auth-hero { padding: 20px 18px 24px; }
  .hero-brand { gap: 9px; }
  .hero-mark { width: 40px; height: 40px; flex-basis: 40px; }
  .hero-name { font-size: 15px; }
  .hero-sub { font-size: 10px; }
  .auth-shell .hero-title { font-size: 27px; }
  .auth-shell .auth-panel { padding: 0 14px 28px; }
  .auth-card { padding: 25px 20px 20px; }
  .auth-heading h2 { font-size: 22px; }
}

@media (prefers-reduced-motion: reduce) {
  .light-spot,
  .seat-grid::after,
  .zone-point,
  .auth-card,
  .auth-form :deep(.s-btn--primary:hover:not(:disabled))::after { animation: none; }
  .badge-copy-enter-active,
  .badge-copy-leave-active { transition: none; }
  .activity-badge.is-active { transform: none; }
  .light-layer { transition: none; }
}
</style>
