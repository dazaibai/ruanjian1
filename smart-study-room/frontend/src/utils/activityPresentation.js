// Translate legacy domain text at the presentation boundary; IDs and API fields stay intact.
const activityNames = [
  [/(?:\d+F[-－])?静音自习室/gi, '观影分享会'],
  [/(?:\d+F[-－])?综合学习区/gi, '校园招聘宣讲会'],
  [/(?:\d+F[-－])?电脑研学[室区]/gi, '计算机竞赛']
]

const terminology = [
  ['智能共享自习室预约系统', '校园活动报名与签到系统'],
  ['全程静音自习区，适合深度学习与备考，禁止讨论与外放。', '共同欣赏精选影片，交流观影感受，分享思考与收获。'],
  ['综合学习区，含静音排、普通排与研讨排，电源充足。', '了解招聘岗位与企业信息，参与校园招聘宣讲与现场交流。'],
  ['每座配备电源与千兆网口，适合编程与在线实验。', '面向编程与算法爱好者的计算机竞赛，提供电源与网络支持。'],
  ['智能共享自习室', '校园活动'],
  ['智能自习室', '校园活动'],
  ['自习室', '活动'],
  ['自习', '活动'],
  ['预约', '报名'],
  ['普通桌', '普通座位'],
  ['插座桌', '电源座位'],
  ['电脑桌', '设备座位'],
  ['桌椅', '座位'],
  ['静音区', '观影区'],
  ['普通区', '宣讲区'],
  ['研讨区', '交流区'],
  ['机房区', '竞赛区'],
  ['学习计划', '活动安排'],
  ['学习助手', '活动助手'],
  ['临时离开', '暂离会场'],
  ['返回座位', '返回会场'],
  ['低分限约', '低分限制报名'],
  ['禁约', '限制报名'],
  ['限约', '限制报名'],
  ['房间', '活动场地']
]

export function activityText(value) {
  if (typeof value !== 'string') return value
  // Descriptions must be translated before the shorter activity names within them.
  for (const [before, after] of terminology.slice(0, 4)) value = value.replaceAll(before, after)
  for (const [before, after] of activityNames) value = value.replace(before, after)
  for (const [before, after] of terminology.slice(4)) value = value.replaceAll(before, after)
  return value
}

const displayFields = new Set(['name', 'room_name', 'description', 'title', 'content', 'message', 'reason'])

export function presentActivityData(value) {
  if (Array.isArray(value)) return value.map(presentActivityData)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    typeof item === 'string' && displayFields.has(key) && !(key === 'content' && value.role === 'user')
      ? activityText(item)
      : presentActivityData(item)
  ]))
}
