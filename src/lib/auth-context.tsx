'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'

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
    const cleanPhone = phone.replace(/\D/g, '')
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .single()

    if (error || !data) return { error: 'Telefone não encontrado. Verifique o número ou faça seu cadastro.' }

    setUser(data)
    localStorage.setItem('rp_user', JSON.stringify(data))
    return {}
  }

  const register = async (name: string, house: string, phone: string): Promise<{ error?: string }> => {
    const cleanPhone = phone.replace(/\D/g, '')

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('house', house)
      .eq('phone', cleanPhone)
      .single()

    if (existing) return { error: 'Essa casa já possui cadastro com este telefone. Faça login.' }

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
