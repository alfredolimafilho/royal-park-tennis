export type User = { id: string; name: string; house: string; phone: string; is_admin: boolean }

export type Reservation = {
  id: string; user_id: string; house: string; phone: string | null
  reservation_date: string; start_time: string; end_time: string; notes: string | null
  users?: { name: string }
}

export type FixedReservation = {
  id: string; user_id: string; house: string
  day_of_week: number; start_time: string; end_time: string; status: string
  users?: { name: string; phone: string }
}
