'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'
import { normalizePhone, phoneVariants } from './phone'

type User = {
  id: string
  name: string
  house: string
  phone: string
  is_admin: boolean
}

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (phone: string) => Promise<{ error?: string }>
  register: (name: string, house: string, phone: string) => Promise<{ error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('rp_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  const login = async (phone: string): Promise<{ error?: string }> => {
    const variants = phoneVariants(phone)
    if (variants.length === 0) return { error: 'Telefone inválido. Verifique o número.' }

    // Busca tolerante a formato (código do país e 9º dígito): aceita qualquer
    // variação plausível do número salvo no cadastro.
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('phone', variants)
      .limit(1)

    const found = data?.[0]
    if (error || !found) return { error: 'Telefone não encontrado. Verifique o número ou faça seu cadastro.' }

    setUser(found)
    localStorage.setItem('rp_user', JSON.stringify(found))
    return {}
  }

  const register = async (name: string, house: string, phone: string): Promise<{ error?: string }> => {
    const cleanPhone = normalizePhone(phone)
    if (!cleanPhone) return { error: 'Telefone inválido. Verifique o número.' }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('house', house)
      .in('phone', phoneVariants(phone))
      .limit(1)

    if (existing && existing.length > 0) return { error: 'Essa casa já possui cadastro com este telefone. Faça login.' }

    const { data, error } = await supabase
      .from('users')
      .insert({ name, house, phone: cleanPhone })
      .select('*')
      .single()

    if (error) return { error: 'Erro ao cadastrar. Tente novamente.' }

    setUser(data)
    localStorage.setItem('rp_user', JSON.stringify(data))
    return {}
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('rp_user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
