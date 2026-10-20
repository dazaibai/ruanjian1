export const zoneName = { quiet: '观影区', regular: '宣讲区', discussion: '交流区', computer: '竞赛区' }
export function seatPosition(room, seat) {
  return { x: (seat.col_no - (room.seat_cols + 1) / 2) * 1.8, z: (seat.row_no - (room.seat_rows + 1) / 2) * 1.9 }
}
export function seatType(s) {
  return s.zone === 'computer' ? '设备座位' : s.has_power ? '电源座位' : '普通座位'
}
export function seatState(s, selectedId) {
  if (s.status !== 'available') return s.status === 'maintenance' ? 'maintenance' : 'disabled'
  if (s.occupied) return 'occupied'
  return s.id === selectedId ? 'selected' : 'available'
}
export const stateLabels = { available: '可报名', selected: '已选中', occupied: '已报名', maintenance: '维护中', disabled: '已停用' }
export const stateColors = { available: '#69bca8', selected: '#5578ee', occupied: '#e3a363', maintenance: '#b19bbd', disabled: '#89929e' }
export function getWindowSides(room, seats) {
  const sides = { top: false, bottom: false, left: false, right: false }
  if (!room || !seats.length) return sides
  const edge = { top: [], bottom: [], left: [], right: [] }
  for (const s of seats) {
    if (s.row_no === 1) edge.top.push(s)
    if (s.row_no === room.seat_rows) edge.bottom.push(s)
    if (s.col_no === 1) edge.left.push(s)
    if (s.col_no === room.seat_cols) edge.right.push(s)
  }
  for (const side of Object.keys(sides)) {
    sides[side] = edge[side].length === (['top', 'bottom'].includes(side) ? room.seat_cols : room.seat_rows) && edge[side].every(s => s.near_window)
  }
  return sides
}
