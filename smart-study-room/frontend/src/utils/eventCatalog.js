const themes = [
  { match: /观影|电影/, category: '观影', host: '校园文化中心', poster: '/posters/film.svg', color: '#2f69df', symbol: '映', note: '带上你的好奇心，在光影之后分享观点。' },
  { match: /招聘|宣讲/, category: '宣讲', host: '就业指导中心', poster: '/posters/career.svg', color: '#008e9e', symbol: '职', note: '了解岗位与企业，和招聘团队面对面交流。' },
  { match: /计算机|竞赛|编程/, category: '竞赛', host: '计算机学院', poster: '/posters/code.svg', color: '#a94e49', symbol: '赛', note: '在挑战中遇见伙伴，展示你的思考与创造。' },
  { match: /户外|徒步|运动/, category: '户外', host: '校团委', poster: '/posters/outdoor.svg', color: '#288466', symbol: '野', note: '户外活动无固定座位，请按现场指引参与。', outdoor: true }
]

export const sampleEvents = [
  { id: 'sample-film', name: '观影分享会', location: '学生活动中心 · 放映厅', open_time: '19:00', close_time: '21:00', seat_rows: 6, seat_cols: 8, description: '精选影片放映与映后交流。' },
  { id: 'sample-career', name: '校园招聘宣讲会', location: '综合楼 · 报告厅', open_time: '14:00', close_time: '16:00', seat_rows: 8, seat_cols: 10, description: '企业介绍、岗位答疑与现场交流。' },
  { id: 'sample-code', name: '计算机竞赛', location: '信息楼 · 实训中心', open_time: '09:00', close_time: '17:00', seat_rows: 5, seat_cols: 6, description: '算法与应用开发挑战。' },
  { id: 'sample-outdoor', name: '校园公益徒步', location: '东门广场集合', open_time: '08:30', close_time: '11:00', seat_rows: 0, seat_cols: 0, description: '一起走进校园绿地，关注身边的公共空间。' }
]

export function eventPresentation(event) {
  return themes.find((theme) => theme.match.test(event?.name || '')) || {
    category: '活动', host: '校园活动中心', poster: '/posters/career.svg', color: '#2563eb', symbol: '校',
    note: event?.description || '与同学一起参与校园活动。'
  }
}

export function eventCapacity(event) {
  return Math.max(0, Number(event?.seat_rows || 0) * Number(event?.seat_cols || 0))
}
