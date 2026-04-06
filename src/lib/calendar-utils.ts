import type { Reservation, FixedReservation } from './types'

export const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const SLOTS: string[] = []
for (let h = 5; h < 23; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

export const PALETTE = [
  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af' },
  { bg: '#ecfeff', text: '#155e75', border: '#67e8f9' },
  { bg: '#fdf4ff', text: '#86198f', border: '#e879f9' },
  { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
  { bg: '#f0fdf4', text: '#15803d', border: '#4ade80' },
  { bg: '#fef9c3', text: '#854d0e', border: '#facc15' },
  { bg: '#e8d5f5', text: '#6b21a8', border: '#c084fc' },
  { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
  { bg: '#cffafe', text: '#164e63', border: '#22d3ee' },
  { bg: '#fde68a', text: '#78350f', border: '#f59e0b' },
]

export function getWeekDates(baseDate: Date): Date[] {
  const d = new Date(baseDate)
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start)
    dt.setDate(start.getDate() + i)
    return dt
  })
}

export function fmtDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function calcEndTime(slot: string, durationMin: number = 60): string {
  const [h, m] = slot.split(':').map(Number)
  const totalMin = h * 60 + m + durationMin
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
}

export function whatsappLink(phone: string, house: string): string {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(`Olá! Sou da ${house} do Royal Park, sobre a reserva da quadra de tênis...`)}`
}

export function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function getHouseColor(house: string) {
  return PALETTE[hashCode(house) % PALETTE.length]
}

export type SlotOccupant = {
  type: 'fixed' | 'reservation'
  house: string
  name?: string
  phone?: string
  id?: string
  userId?: string
  startTime?: string
  endTime?: string
}

export function getSlotOccupant(
  date: Date,
  time: string,
  reservations: Reservation[],
  fixedRes: FixedReservation[],
): SlotOccupant | null {
  const dateStr = fmtDateISO(date)
  const dayOfWeek = date.getDay()

  // Check fixed reservations (slice to 5 chars to compare HH:MM without seconds)
  for (const fr of fixedRes) {
    const fStart = fr.start_time.slice(0, 5)
    const fEnd = fr.end_time.slice(0, 5)
    if (fr.day_of_week === dayOfWeek && fStart <= time && fEnd > time) {
      return { type: 'fixed', house: fr.house, name: fr.users?.name, phone: fr.users?.phone, id: fr.id, userId: fr.user_id, startTime: fStart, endTime: fEnd }
    }
  }

  // Check regular reservations
  for (const r of reservations) {
    const rStart = r.start_time.slice(0, 5)
    const rEnd = r.end_time.slice(0, 5)
    if (r.reservation_date === dateStr && rStart <= time && rEnd > time) {
      return { type: 'reservation', house: r.house, name: r.users?.name, phone: r.phone || undefined, id: r.id, userId: r.user_id, startTime: rStart, endTime: rEnd }
    }
  }

  return null
}

export function canReserve(
  date: string,
  startTime: string,
  dur: number,
  reservations: Reservation[],
  fixedRes: FixedReservation[],
  userHouse: string,
): { ok: boolean; reason?: string } {
  const endTime = calcEndTime(startTime, dur)
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()

  // Check end time doesn't exceed 23:00
  if (endTime > '23:00') return { ok: false, reason: 'A quadra funciona até 23:00.' }

  // Check if any slot in the range is already taken
  const dt = new Date(date + 'T12:00:00')
  for (const slot of SLOTS) {
    if (slot >= startTime && slot < endTime && getSlotOccupant(dt, slot, reservations, fixedRes)) {
      return { ok: false, reason: 'Horário já reservado.' }
    }
  }

  // Count existing reservations for this house on this date
  const houseResOnDate = reservations.filter(r =>
    r.reservation_date === date && r.house === userHouse
  )
  const houseFixedOnDay = fixedRes.filter(f =>
    f.day_of_week === dayOfWeek && f.house === userHouse
  )

  const totalSlots = houseResOnDate.length + houseFixedOnDay.length
  if (totalSlots >= 2) return { ok: false, reason: 'Sua casa já tem 2 reservas neste dia.' }

  // Check total contiguous time doesn't exceed 1h
  for (const r of houseResOnDate) {
    const rStart = r.start_time.slice(0, 5)
    const rEnd = r.end_time.slice(0, 5)
    const [rh1, rm1] = rStart.split(':').map(Number)
    const [rh2, rm2] = rEnd.split(':').map(Number)
    const existingDur = (rh2 * 60 + rm2) - (rh1 * 60 + rm1)
    if (r.end_time.slice(0, 5) === startTime && existingDur + dur > 60) {
      return { ok: false, reason: 'Não é permitido ultrapassar 1h seguida de reserva.' }
    }
    if (endTime === rStart && existingDur + dur > 60) {
      return { ok: false, reason: 'Não é permitido ultrapassar 1h seguida de reserva.' }
    }
  }
  for (const f of houseFixedOnDay) {
    const fStart = f.start_time.slice(0, 5)
    const fEnd = f.end_time.slice(0, 5)
    const [fh1, fm1] = fStart.split(':').map(Number)
    const [fh2, fm2] = fEnd.split(':').map(Number)
    const existingDur = (fh2 * 60 + fm2) - (fh1 * 60 + fm1)
    if (fEnd === startTime && existingDur + dur > 60) {
      return { ok: false, reason: 'Não é permitido ultrapassar 1h seguida (inclui sua reserva fixa).' }
    }
    if (endTime === fStart && existingDur + dur > 60) {
      return { ok: false, reason: 'Não é permitido ultrapassar 1h seguida (inclui sua reserva fixa).' }
    }
  }

  return { ok: true }
}
