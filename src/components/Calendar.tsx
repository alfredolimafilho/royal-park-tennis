'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type User = { id: string; name: string; house: string; phone: string; is_admin: boolean }
type Reservation = {
  id: string; user_id: string; house: string; phone: string | null
  reservation_date: string; start_time: string; end_time: string; notes: string | null
}
type FixedReservation = {
  id: string; user_id: string; house: string
  day_of_week: number; start_time: string; end_time: string; status: string
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const SLOTS: string[] = []
for (let h = 5; h < 23; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

function getWeekDates(baseDate: Date): Date[] {
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

function fmtDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function endTimeForSlot(slot: string): string {
  const [h, m] = slot.split(':').map(Number)
  const totalMin = h * 60 + m + 60
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
}

function whatsappLink(phone: string, house: string): string {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(`Olá! Sou da ${house} do Royal Park, sobre a reserva da quadra de tênis...`)}`
}

// Coluna de cores por casa para diferenciar visualmente
const HOUSE_COLORS: Record<string, { bg: string; text: string; border: string }> = {}
const PALETTE = [
  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af' },
  { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  { bg: '#ecfeff', text: '#155e75', border: '#67e8f9' },
  { bg: '#fdf4ff', text: '#86198f', border: '#e879f9' },
  { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
]
let colorIdx = 0
function getHouseColor(house: string) {
  if (!HOUSE_COLORS[house]) {
    HOUSE_COLORS[house] = PALETTE[colorIdx % PALETTE.length]
    colorIdx++
  }
  return HOUSE_COLORS[house]
}

export default function Calendar({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [weekBase, setWeekBase] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [fixedRes, setFixedRes] = useState<FixedReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'calendar' | 'fixed' | 'admin'>('calendar')

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  const [editingRes, setEditingRes] = useState<Reservation | null>(null)

  // Fixed reservation modal
  const [showFixedModal, setShowFixedModal] = useState(false)
  const [fixedForm, setFixedForm] = useState({ day_of_week: 1, start_time: '17:00' })

  const weekDates = getWeekDates(weekBase)

  const load = useCallback(async () => {
    setLoading(true)
    const startDate = fmtDateISO(weekDates[0])
    const endDate = fmtDateISO(weekDates[6])

    const [{ data: res }, { data: fixed }] = await Promise.all([
      supabase.from('reservations').select('*')
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate)
        .order('start_time'),
      supabase.from('fixed_reservations').select('*').eq('status', 'approved'),
    ])
    setReservations(res || [])
    setFixedRes(fixed || [])
    setLoading(false)
  }, [weekBase])

  useEffect(() => { load() }, [load])

  // Get what occupies a slot
  function getSlotOccupant(date: Date, time: string): { type: 'fixed' | 'reservation'; house: string; phone?: string; id?: string; userId?: string } | null {
    const dateStr = fmtDateISO(date)
    const dayOfWeek = date.getDay()
    const slotEnd = endTimeForSlot(time)

    // Check fixed reservations
    for (const fr of fixedRes) {
      if (fr.day_of_week === dayOfWeek && fr.start_time <= time && fr.end_time > time) {
        return { type: 'fixed', house: fr.house, id: fr.id, userId: fr.user_id }
      }
    }

    // Check regular reservations
    for (const r of reservations) {
      if (r.reservation_date === dateStr && r.start_time <= time && r.end_time > time) {
        return { type: 'reservation', house: r.house, phone: r.phone || undefined, id: r.id, userId: r.user_id }
      }
    }

    return null
  }

  // Check if a house can reserve at this date (max 1h contiguous, max 2 distinct slots)
  function canReserve(date: string, startTime: string): { ok: boolean; reason?: string } {
    const endTime = endTimeForSlot(startTime)
    const dayOfWeek = new Date(date + 'T12:00:00').getDay()

    // Check if slot already taken
    const dt = new Date(date + 'T12:00:00')
    // Check both 30-min halves
    if (getSlotOccupant(dt, startTime)) return { ok: false, reason: 'Horário já reservado.' }
    const halfTime = `${String(parseInt(startTime.split(':')[0])).padStart(2, '0')}:${startTime.split(':')[1] === '00' ? '30' : '00'}`
    // Actually check if the full hour overlaps with anything
    for (const slot of SLOTS) {
      if (slot >= startTime && slot < endTime && getSlotOccupant(dt, slot)) {
        return { ok: false, reason: 'Horário já reservado.' }
      }
    }

    // Count existing reservations for this house on this date
    const houseResOnDate = reservations.filter(r =>
      r.reservation_date === date && r.house === user.house
    )
    // Also count fixed for this day
    const houseFixedOnDay = fixedRes.filter(f =>
      f.day_of_week === dayOfWeek && f.house === user.house
    )

    const totalSlots = houseResOnDate.length + houseFixedOnDay.length
    if (totalSlots >= 2) return { ok: false, reason: 'Sua casa já tem 2 reservas neste dia.' }

    // Check no adjacent (contiguous) - new reservation can't be adjacent to existing
    for (const r of houseResOnDate) {
      if (r.end_time === startTime || endTime === r.start_time) {
        return { ok: false, reason: 'Não é permitido reservar horários consecutivos (máximo 1h seguida).' }
      }
    }
    for (const f of houseFixedOnDay) {
      if (f.end_time === startTime || endTime === f.start_time) {
        return { ok: false, reason: 'Não é permitido reservar horário consecutivo à sua reserva fixa.' }
      }
    }

    return { ok: true }
  }

  const openCreateModal = (date: string, time: string) => {
    setSelectedSlot({ date, time })
    setModalMode('create')
    setEditingRes(null)
    setShowModal(true)
  }

  const openEditModal = (res: Reservation) => {
    setEditingRes(res)
    setModalMode('edit')
    setShowModal(true)
  }

  const saveReservation = async () => {
    if (!selectedSlot) return
    const { date, time } = selectedSlot
    const check = canReserve(date, time)
    if (!check.ok) { alert(check.reason); return }

    await supabase.from('reservations').insert({
      user_id: user.id,
      house: user.house,
      phone: user.phone,
      reservation_date: date,
      start_time: time,
      end_time: endTimeForSlot(time),
    })
    setShowModal(false)
    load()
  }

  const deleteReservation = async (id: string) => {
    if (!confirm('Deseja excluir esta reserva?')) return
    await supabase.from('reservations').delete().eq('id', id)
    setShowModal(false)
    load()
  }

  const updateReservation = async (id: string, newDate: string, newTime: string) => {
    await supabase.from('reservations').update({
      reservation_date: newDate,
      start_time: newTime,
      end_time: endTimeForSlot(newTime),
    }).eq('id', id)
    setShowModal(false)
    load()
  }

  // Fixed reservation handlers
  const requestFixed = async () => {
    await supabase.from('fixed_reservations').insert({
      user_id: user.id,
      house: user.house,
      day_of_week: fixedForm.day_of_week,
      start_time: fixedForm.start_time,
      end_time: endTimeForSlot(fixedForm.start_time),
      status: 'pending',
    })
    setShowFixedModal(false)
    alert('Solicitação enviada! Aguarde a aprovação do administrador.')
    load()
  }

  // Admin handlers
  const approveFixed = async (id: string) => {
    await supabase.from('fixed_reservations').update({ status: 'approved' }).eq('id', id)
    load()
  }
  const rejectFixed = async (id: string) => {
    await supabase.from('fixed_reservations').update({ status: 'rejected' }).eq('id', id)
    load()
  }

  const prevWeek = () => {
    const d = new Date(weekBase)
    d.setDate(d.getDate() - 7)
    setWeekBase(d)
  }
  const nextWeek = () => {
    const d = new Date(weekBase)
    d.setDate(d.getDate() + 7)
    setWeekBase(d)
  }
  const goToday = () => setWeekBase(new Date())

  const today = fmtDateISO(new Date())

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4a7c59' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={1.5} />
                <path stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Quadra de Tênis</h1>
              <p className="text-xs text-gray-400">Royal Park</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">{user.name} · <span className="font-semibold">{user.house}</span></span>
            {user.is_admin && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Admin</span>}
            <button onClick={onLogout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Sair</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          <button onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'calendar' ? 'border-[#4a7c59] text-[#4a7c59]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Reserva Avulsa
          </button>
          <button onClick={() => setActiveTab('fixed')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'fixed' ? 'border-[#4a7c59] text-[#4a7c59]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Reserva Fixa
          </button>
          {user.is_admin && (
            <button onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'admin' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              Admin
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {activeTab === 'calendar' && (
          <>
            {/* Week navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={goToday} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">Hoje</button>
                <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* Calendar grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#4a7c59] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-gray-50 z-10 w-16 px-2 py-3 text-xs font-semibold text-gray-500 border-b border-r border-gray-200">Horário</th>
                      {weekDates.map((d, i) => {
                        const isToday = fmtDateISO(d) === today
                        return (
                          <th key={i} className={`px-1 py-3 text-center border-b border-gray-200 ${isToday ? 'bg-[#4a7c59]/5' : 'bg-gray-50'}`}>
                            <p className="text-xs font-semibold text-gray-400">{DAYS[d.getDay()]}</p>
                            <p className={`text-lg font-bold ${isToday ? 'text-[#4a7c59]' : 'text-gray-700'}`}>{d.getDate()}</p>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map((slot, si) => (
                      <tr key={slot} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="sticky left-0 bg-white z-10 px-2 py-0 text-xs text-gray-400 font-medium border-r border-gray-100 text-right whitespace-nowrap">
                          {slot}
                        </td>
                        {weekDates.map((d, di) => {
                          const occupant = getSlotOccupant(d, slot)
                          const dateStr = fmtDateISO(d)
                          const isToday = dateStr === today
                          const isPast = dateStr < today

                          if (occupant) {
                            // Check if this is the start of the reservation block
                            const prevSlotIdx = si > 0 ? si - 1 : -1
                            const prevOccupant = prevSlotIdx >= 0 ? getSlotOccupant(d, SLOTS[prevSlotIdx]) : null
                            const isStart = !prevOccupant || prevOccupant.id !== occupant.id

                            if (!isStart) return null // merged cell

                            // Count how many consecutive slots
                            let span = 1
                            for (let k = si + 1; k < SLOTS.length; k++) {
                              const next = getSlotOccupant(d, SLOTS[k])
                              if (next && next.id === occupant.id) span++
                              else break
                            }

                            const colors = getHouseColor(occupant.house)
                            const isOwn = occupant.userId === user.id

                            return (
                              <td key={di} rowSpan={span}
                                className={`border border-gray-100 p-0.5 align-top ${isToday ? 'bg-[#4a7c59]/5' : ''}`}>
                                <div
                                  className={`rounded-lg px-2 py-1.5 h-full flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${isOwn ? 'ring-2 ring-offset-1' : ''}`}
                                  style={{ backgroundColor: colors.bg, borderLeft: `3px solid ${colors.border}`, color: colors.text, ...(isOwn ? { ringColor: colors.border } : {}) }}
                                  onClick={() => {
                                    if (occupant.type === 'reservation' && isOwn) {
                                      const res = reservations.find(r => r.id === occupant.id)
                                      if (res) openEditModal(res)
                                    }
                                  }}
                                >
                                  <div>
                                    <p className="text-xs font-bold leading-tight">{occupant.house}</p>
                                    <p className="text-[10px] opacity-70">{occupant.type === 'fixed' ? 'Fixa' : 'Avulsa'}</p>
                                  </div>
                                  {occupant.phone && (
                                    <a href={whatsappLink(occupant.phone, occupant.house)}
                                      target="_blank" rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium opacity-80 hover:opacity-100">
                                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.913.913l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.347 0-4.522-.802-6.246-2.147l-.436-.353-3.3 1.106 1.106-3.3-.353-.436A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                                      </svg>
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              </td>
                            )
                          }

                          // Empty slot - available
                          return (
                            <td key={di}
                              className={`border border-gray-100 p-0.5 h-8 ${isToday ? 'bg-[#4a7c59]/5' : ''} ${isPast ? 'bg-gray-50' : 'cursor-pointer hover:bg-green-50 group'}`}
                              onClick={() => {
                                if (isPast) return
                                openCreateModal(dateStr, slot)
                              }}>
                              {!isPast && (
                                <div className="w-full h-full rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border border-gray-200 bg-white" />
                <span>Livre</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac' }} />
                <span>Reservado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded ring-2 ring-offset-1 ring-gray-300" style={{ backgroundColor: '#dbeafe' }} />
                <span>Sua reserva</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'fixed' && (
          <FixedTab
            user={user}
            fixedRes={fixedRes}
            onRequest={() => setShowFixedModal(true)}
            onRefresh={load}
          />
        )}

        {activeTab === 'admin' && user.is_admin && (
          <AdminTab onApprove={approveFixed} onReject={rejectFixed} />
        )}
      </main>

      {/* CREATE/EDIT RESERVATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            {modalMode === 'create' && selectedSlot && (
              <>
                <h2 className="text-lg font-bold text-gray-900">Nova Reserva</h2>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-green-800">
                    {new Date(selectedSlot.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {selectedSlot.time} — {endTimeForSlot(selectedSlot.time)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">{user.house} · {user.name}</p>
                </div>
                {(() => {
                  const check = canReserve(selectedSlot.date, selectedSlot.time)
                  if (!check.ok) return (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{check.reason}</div>
                  )
                  return null
                })()}
                <div className="flex gap-3">
                  <button onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button onClick={saveReservation}
                    disabled={!canReserve(selectedSlot.date, selectedSlot.time).ok}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: '#4a7c59' }}>
                    Confirmar
                  </button>
                </div>
              </>
            )}

            {modalMode === 'edit' && editingRes && (
              <>
                <h2 className="text-lg font-bold text-gray-900">Sua Reserva</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-blue-800">
                    {new Date(editingRes.reservation_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {editingRes.start_time.slice(0, 5)} — {editingRes.end_time.slice(0, 5)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">{editingRes.house}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Fechar</button>
                  <button onClick={() => deleteReservation(editingRes.id)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* FIXED RESERVATION REQUEST MODAL */}
      {showFixedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFixedModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Solicitar Reserva Fixa</h2>
            <p className="text-sm text-gray-500">Escolha o dia da semana e horário. A reserva será analisada pelo administrador.</p>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dia da semana</label>
              <select value={fixedForm.day_of_week}
                onChange={e => setFixedForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#4a7c59]">
                {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Horário de início</label>
              <select value={fixedForm.start_time}
                onChange={e => setFixedForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#4a7c59]">
                {SLOTS.map(s => <option key={s} value={s}>{s} — {endTimeForSlot(s)}</option>)}
              </select>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
              <p><span className="font-semibold">{user.house}</span> · Toda {DAYS_FULL[fixedForm.day_of_week].toLowerCase()}</p>
              <p className="font-bold text-gray-900">{fixedForm.start_time} — {endTimeForSlot(fixedForm.start_time)}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowFixedModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={requestFixed}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#4a7c59' }}>
                Solicitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// FIXED TAB COMPONENT
function FixedTab({ user, fixedRes, onRequest, onRefresh }: {
  user: User; fixedRes: FixedReservation[]; onRequest: () => void; onRefresh: () => void
}) {
  const [allFixed, setAllFixed] = useState<FixedReservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('fixed_reservations').select('*').order('day_of_week')
      setAllFixed(data || [])
      setLoading(false)
    })()
  }, [fixedRes])

  const myFixed = allFixed.filter(f => f.user_id === user.id)
  const approvedFixed = allFixed.filter(f => f.status === 'approved')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reservas Fixas</h2>
          <p className="text-sm text-gray-500">Horários fixos semanais aprovados</p>
        </div>
        <button onClick={onRequest}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl"
          style={{ backgroundColor: '#4a7c59' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Solicitar Reserva Fixa
        </button>
      </div>

      {/* My requests */}
      {myFixed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Minhas solicitações</h3>
          <div className="grid gap-2">
            {myFixed.map(f => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{DAYS_FULL[f.day_of_week]}</p>
                  <p className="text-xs text-gray-500">{f.start_time.slice(0, 5)} — {f.end_time.slice(0, 5)}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  f.status === 'approved' ? 'bg-green-50 text-green-700' :
                  f.status === 'rejected' ? 'bg-red-50 text-red-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {f.status === 'approved' ? 'Aprovada' : f.status === 'rejected' ? 'Recusada' : 'Pendente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All approved grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Grade semanal de horários fixos</h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Dia</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Horário</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Casa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={3} className="py-8 text-center text-sm text-gray-400">Carregando...</td></tr>
              ) : approvedFixed.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-sm text-gray-400">Nenhuma reserva fixa aprovada</td></tr>
              ) : (
                approvedFixed.map(f => {
                  const colors = getHouseColor(f.house)
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{DAYS_FULL[f.day_of_week]}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{f.start_time.slice(0, 5)} — {f.end_time.slice(0, 5)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: colors.bg, color: colors.text }}>{f.house}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ADMIN TAB COMPONENT
function AdminTab({ onApprove, onReject }: { onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const [pending, setPending] = useState<(FixedReservation & { users?: { name: string; house: string; phone: string } })[]>([])
  const [allRes, setAllRes] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  const loadAdmin = useCallback(async () => {
    setLoading(true)
    const [{ data: pend }, { data: res }] = await Promise.all([
      supabase.from('fixed_reservations').select('*, users(name, house, phone)').eq('status', 'pending'),
      supabase.from('reservations').select('*').gte('reservation_date', fmtDateISO(new Date())).order('reservation_date'),
    ])
    setPending(pend || [])
    setAllRes(res || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAdmin() }, [loadAdmin])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Painel Administrativo</h2>

      {/* Pending approvals */}
      <div>
        <h3 className="text-sm font-semibold text-amber-600 mb-2">Solicitações Pendentes</h3>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            Nenhuma solicitação pendente
          </div>
        ) : (
          <div className="grid gap-2">
            {pending.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.house}</p>
                  <p className="text-xs text-gray-500">{DAYS_FULL[p.day_of_week]} · {p.start_time.slice(0, 5)} — {p.end_time.slice(0, 5)}</p>
                  {p.users && <p className="text-xs text-gray-400 mt-0.5">{p.users.name} · {p.users.phone}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { onApprove(p.id); loadAdmin() }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                    Aprovar
                  </button>
                  <button onClick={() => { onReject(p.id); loadAdmin() }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming reservations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Próximas reservas avulsas</h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Data</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Horário</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Casa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allRes.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-sm text-gray-400">Nenhuma reserva futura</td></tr>
              ) : (
                allRes.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(r.reservation_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.start_time.slice(0, 5)} — {r.end_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{r.house}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
