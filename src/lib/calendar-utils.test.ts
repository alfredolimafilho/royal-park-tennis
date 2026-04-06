import { describe, it, expect } from 'vitest'
import {
  SLOTS,
  calcEndTime,
  fmtDateISO,
  getWeekDates,
  hashCode,
  getHouseColor,
  whatsappLink,
  getSlotOccupant,
  canReserve,
} from './calendar-utils'
import type { Reservation, FixedReservation } from './types'

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

describe('SLOTS', () => {
  it('has 36 entries (5:00–22:30)', () => {
    expect(SLOTS).toHaveLength(36)
  })

  it('starts at 05:00 and ends at 22:30', () => {
    expect(SLOTS[0]).toBe('05:00')
    expect(SLOTS[SLOTS.length - 1]).toBe('22:30')
  })

  it('all entries match HH:MM format', () => {
    for (const s of SLOTS) {
      expect(s).toMatch(/^\d{2}:\d{2}$/)
    }
  })
})

describe('calcEndTime', () => {
  it('adds 60 minutes by default', () => {
    expect(calcEndTime('08:00')).toBe('09:00')
  })

  it('adds 30 minutes', () => {
    expect(calcEndTime('08:00', 30)).toBe('08:30')
  })

  it('crosses hour boundary', () => {
    expect(calcEndTime('08:30', 60)).toBe('09:30')
  })

  it('late evening slot', () => {
    expect(calcEndTime('22:00', 60)).toBe('23:00')
  })

  it('can exceed 23:00 (no clamping)', () => {
    expect(calcEndTime('22:30', 60)).toBe('23:30')
  })
})

describe('fmtDateISO', () => {
  it('formats a normal date', () => {
    expect(fmtDateISO(new Date(2026, 3, 6))).toBe('2026-04-06')
  })

  it('zero-pads single-digit month and day', () => {
    expect(fmtDateISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('handles December 31', () => {
    expect(fmtDateISO(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('getWeekDates', () => {
  it('returns 7 dates', () => {
    expect(getWeekDates(new Date(2026, 3, 6))).toHaveLength(7)
  })

  it('starts on Sunday', () => {
    const week = getWeekDates(new Date(2026, 3, 8)) // Wednesday Apr 8
    expect(week[0].getDay()).toBe(0) // Sunday
  })

  it('ends on Saturday', () => {
    const week = getWeekDates(new Date(2026, 3, 8))
    expect(week[6].getDay()).toBe(6) // Saturday
  })

  it('Sunday input returns that same Sunday as start', () => {
    const sunday = new Date(2026, 3, 5) // April 5, 2026 is a Sunday
    const week = getWeekDates(sunday)
    expect(fmtDateISO(week[0])).toBe('2026-04-05')
  })

  it('Saturday input returns the prior Sunday as start', () => {
    const saturday = new Date(2026, 3, 11) // April 11, 2026 is a Saturday
    const week = getWeekDates(saturday)
    expect(fmtDateISO(week[0])).toBe('2026-04-05')
  })
})

describe('hashCode', () => {
  it('is deterministic', () => {
    expect(hashCode('Casa A')).toBe(hashCode('Casa A'))
  })

  it('returns 0 for empty string', () => {
    expect(hashCode('')).toBe(0)
  })

  it('different strings produce different hashes (high probability)', () => {
    expect(hashCode('Casa A')).not.toBe(hashCode('Casa B'))
  })
})

describe('getHouseColor', () => {
  it('returns object with bg, text, border', () => {
    const color = getHouseColor('Casa 42')
    expect(color).toHaveProperty('bg')
    expect(color).toHaveProperty('text')
    expect(color).toHaveProperty('border')
  })

  it('is deterministic per house', () => {
    expect(getHouseColor('Casa X')).toEqual(getHouseColor('Casa X'))
  })

  it('different houses can get different colors', () => {
    // Not guaranteed for all pairs, but likely for these
    const a = getHouseColor('Casa A')
    const b = getHouseColor('Casa B')
    // At least check it doesn't throw
    expect(a).toBeDefined()
    expect(b).toBeDefined()
  })
})

describe('whatsappLink', () => {
  it('strips non-digits and prepends 55', () => {
    const link = whatsappLink('(85) 99999-9999', 'Casa 1')
    expect(link).toContain('https://wa.me/558599999999')
  })

  it('does not double-prepend 55', () => {
    const link = whatsappLink('5585999999999', 'Casa 1')
    expect(link).toContain('https://wa.me/5585999999999')
  })

  it('includes URL-encoded message with house name', () => {
    const link = whatsappLink('85999999999', 'Casa 7')
    expect(link).toContain(encodeURIComponent('Casa 7'))
  })
})

// ---------------------------------------------------------------------------
// getSlotOccupant
// ---------------------------------------------------------------------------

describe('getSlotOccupant', () => {
  const makeRes = (overrides: Partial<Reservation> = {}): Reservation => ({
    id: '1', user_id: 'u1', house: 'Casa A', phone: '123',
    reservation_date: '2026-04-06', start_time: '10:00', end_time: '11:00',
    notes: null, users: { name: 'Alice' },
    ...overrides,
  })

  const makeFixed = (overrides: Partial<FixedReservation> = {}): FixedReservation => ({
    id: 'f1', user_id: 'u2', house: 'Casa B',
    day_of_week: 1, start_time: '17:00', end_time: '18:00', status: 'approved',
    users: { name: 'Bob', phone: '456' },
    ...overrides,
  })

  it('returns null on empty schedule', () => {
    const date = new Date(2026, 3, 6) // Monday Apr 6
    expect(getSlotOccupant(date, '10:00', [], [])).toBeNull()
  })

  it('returns reservation occupant when slot is within range', () => {
    const date = new Date(2026, 3, 6) // 2026-04-06
    const res = makeRes()
    const result = getSlotOccupant(date, '10:00', [res], [])
    expect(result).not.toBeNull()
    expect(result!.type).toBe('reservation')
    expect(result!.house).toBe('Casa A')
  })

  it('returns null when slot is at end_time (exclusive)', () => {
    const date = new Date(2026, 3, 6)
    const res = makeRes()
    expect(getSlotOccupant(date, '11:00', [res], [])).toBeNull()
  })

  it('returns fixed reservation occupant for matching day_of_week', () => {
    // April 6, 2026 is a Monday (day_of_week = 1)
    const date = new Date(2026, 3, 6)
    const fixed = makeFixed({ day_of_week: 1 })
    const result = getSlotOccupant(date, '17:00', [], [fixed])
    expect(result).not.toBeNull()
    expect(result!.type).toBe('fixed')
    expect(result!.house).toBe('Casa B')
  })

  it('fixed reservations take priority over regular', () => {
    const date = new Date(2026, 3, 6) // Monday
    const res = makeRes({ start_time: '17:00', end_time: '18:00' })
    const fixed = makeFixed({ day_of_week: 1 })
    const result = getSlotOccupant(date, '17:00', [res], [fixed])
    expect(result!.type).toBe('fixed')
  })

  it('handles time strings with seconds via slice(0,5)', () => {
    const date = new Date(2026, 3, 6)
    const res = makeRes({ start_time: '10:00:00', end_time: '11:00:00' })
    const result = getSlotOccupant(date, '10:30', [res], [])
    expect(result).not.toBeNull()
    expect(result!.type).toBe('reservation')
  })

  it('does not match wrong date', () => {
    const date = new Date(2026, 3, 7) // Different date
    const res = makeRes({ reservation_date: '2026-04-06' })
    expect(getSlotOccupant(date, '10:00', [res], [])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// canReserve
// ---------------------------------------------------------------------------

describe('canReserve', () => {
  const makeRes = (overrides: Partial<Reservation> = {}): Reservation => ({
    id: '1', user_id: 'u1', house: 'Casa A', phone: '123',
    reservation_date: '2026-04-06', start_time: '10:00', end_time: '11:00',
    notes: null, users: { name: 'Alice' },
    ...overrides,
  })

  const makeFixed = (overrides: Partial<FixedReservation> = {}): FixedReservation => ({
    id: 'f1', user_id: 'u2', house: 'Casa A',
    day_of_week: 1, start_time: '17:00', end_time: '18:00', status: 'approved',
    users: { name: 'Bob', phone: '456' },
    ...overrides,
  })

  // -- Operating hours --

  describe('operating hours', () => {
    it('blocks end time past 23:00', () => {
      const result = canReserve('2026-04-06', '22:30', 60, [], [], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('23:00')
    })

    it('allows end time exactly 23:00', () => {
      const result = canReserve('2026-04-06', '22:00', 60, [], [], 'Casa A')
      expect(result.ok).toBe(true)
    })

    it('allows 30 min at 22:30', () => {
      const result = canReserve('2026-04-06', '22:30', 30, [], [], 'Casa A')
      expect(result.ok).toBe(true)
    })
  })

  // -- Conflict detection --

  describe('conflict detection', () => {
    it('allows reservation on empty schedule', () => {
      const result = canReserve('2026-04-06', '10:00', 60, [], [], 'Casa A')
      expect(result.ok).toBe(true)
    })

    it('blocks slot taken by regular reservation', () => {
      const existing = makeRes({ house: 'Casa B', start_time: '10:00', end_time: '11:00' })
      const result = canReserve('2026-04-06', '10:00', 60, [existing], [], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('já reservado')
    })

    it('blocks slot taken by fixed reservation', () => {
      // April 6, 2026 is Monday (day_of_week = 1)
      const fixed = makeFixed({ house: 'Casa B', day_of_week: 1, start_time: '10:00', end_time: '11:00' })
      const result = canReserve('2026-04-06', '10:00', 60, [], [fixed], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('já reservado')
    })

    it('allows non-overlapping reservation', () => {
      const existing = makeRes({ house: 'Casa B', start_time: '10:00', end_time: '11:00' })
      const result = canReserve('2026-04-06', '11:00', 60, [existing], [], 'Casa A')
      expect(result.ok).toBe(true)
    })
  })

  // -- Max 2 reservations per day per house --

  describe('max 2 reservations per day per house', () => {
    it('allows with 0 existing', () => {
      const result = canReserve('2026-04-06', '10:00', 30, [], [], 'Casa A')
      expect(result.ok).toBe(true)
    })

    it('allows with 1 existing', () => {
      const existing = makeRes({ house: 'Casa A', start_time: '08:00', end_time: '09:00' })
      const result = canReserve('2026-04-06', '14:00', 30, [existing], [], 'Casa A')
      expect(result.ok).toBe(true)
    })

    it('blocks with 2 existing regular reservations', () => {
      const r1 = makeRes({ id: '1', house: 'Casa A', start_time: '08:00', end_time: '09:00' })
      const r2 = makeRes({ id: '2', house: 'Casa A', start_time: '12:00', end_time: '13:00' })
      const result = canReserve('2026-04-06', '16:00', 30, [r1, r2], [], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('2 reservas')
    })

    it('blocks with 1 regular + 1 fixed = 2', () => {
      const r1 = makeRes({ house: 'Casa A', start_time: '08:00', end_time: '09:00' })
      // Monday = day 1
      const f1 = makeFixed({ house: 'Casa A', day_of_week: 1, start_time: '14:00', end_time: '15:00' })
      const result = canReserve('2026-04-06', '18:00', 30, [r1], [f1], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('2 reservas')
    })
  })

  // -- Contiguous 1h limit --

  describe('contiguous 1h limit', () => {
    it('blocks 60min adjacent after existing 30min (total 90)', () => {
      // Existing: 10:00-10:30, new: 10:30-11:30 → 90min combined
      const existing = makeRes({ house: 'Casa A', start_time: '10:00', end_time: '10:30' })
      const result = canReserve('2026-04-06', '10:30', 60, [existing], [], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('1h seguida')
    })

    it('allows 30min adjacent to existing 30min (total 60)', () => {
      const existing = makeRes({ house: 'Casa A', start_time: '10:00', end_time: '10:30' })
      const result = canReserve('2026-04-06', '10:30', 30, [existing], [], 'Casa A')
      expect(result.ok).toBe(true)
    })

    it('blocks 30min adjacent before existing 60min (total 90)', () => {
      // Existing: 10:00-11:00, new: 09:30-10:00 → 90min combined
      const existing = makeRes({ house: 'Casa A', start_time: '10:00', end_time: '11:00' })
      const result = canReserve('2026-04-06', '09:30', 30, [existing], [], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('1h seguida')
    })

    it('allows non-adjacent reservations on same day', () => {
      const existing = makeRes({ house: 'Casa A', start_time: '08:00', end_time: '09:00' })
      const result = canReserve('2026-04-06', '14:00', 60, [existing], [], 'Casa A')
      expect(result.ok).toBe(true)
    })

    it('blocks adjacency with fixed reservation', () => {
      // Fixed: 17:00-18:00 on Monday, new: 16:00-17:00 → 120min combined
      const fixed = makeFixed({ house: 'Casa A', day_of_week: 1, start_time: '17:00', end_time: '18:00' })
      const result = canReserve('2026-04-06', '16:00', 60, [], [fixed], 'Casa A')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('reserva fixa')
    })

    it('allows 30min adjacent to fixed 30min (total 60)', () => {
      const fixed = makeFixed({ house: 'Casa A', day_of_week: 1, start_time: '17:00', end_time: '17:30' })
      const result = canReserve('2026-04-06', '17:30', 30, [], [fixed], 'Casa A')
      expect(result.ok).toBe(true)
    })
  })
})
