'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Calendar from '@/components/Calendar'

export default function Home() {
  const { user, loading, login, register, logout } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', house: '', phone: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8faf8]">
        <div className="w-10 h-10 border-3 border-[#4a7c59] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8faf8] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: '#4a7c59' }}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={1.5} />
                <path stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3M5.64 5.64l2.12 2.12m8.48 8.48l2.12 2.12M5.64 18.36l2.12-2.12m8.48-8.48l2.12-2.12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Quadra de Tênis</h1>
            <p className="text-sm text-gray-500 mt-1">Condomínio Royal Park</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button onClick={() => { setTab('login'); setError('') }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'login' ? 'text-[#4a7c59] border-b-2 border-[#4a7c59]' : 'text-gray-400'}`}>
                Entrar
              </button>
              <button onClick={() => { setTab('register'); setError('') }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'register' ? 'text-[#4a7c59] border-b-2 border-[#4a7c59]' : 'text-gray-400'}`}>
                Cadastrar
              </button>
            </div>

            <div className="p-6 space-y-4">
              {tab === 'register' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome completo</label>
                  <input type="text" placeholder="Seu nome"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4a7c59] transition-colors" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Casa</label>
                <input type="text" placeholder="Ex: Casa 12"
                  value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4a7c59] transition-colors" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefone</label>
                <input type="tel" placeholder="(85) 99999-9999"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4a7c59] transition-colors" />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <button
                disabled={submitting}
                onClick={async () => {
                  setError('')
                  if (tab === 'register' && !form.name.trim()) { setError('Preencha seu nome.'); return }
                  if (!form.house.trim()) { setError('Preencha a casa.'); return }
                  if (!form.phone.trim()) { setError('Preencha o telefone.'); return }
                  setSubmitting(true)
                  const result = tab === 'login'
                    ? await login(form.house.trim(), form.phone.trim())
                    : await register(form.name.trim(), form.house.trim(), form.phone.trim())
                  if (result.error) setError(result.error)
                  setSubmitting(false)
                }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#4a7c59' }}>
                {submitting ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">Royal Park Condominium</p>
        </div>
      </div>
    )
  }

  return <Calendar user={user} onLogout={logout} />
}
