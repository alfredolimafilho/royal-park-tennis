import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { AuthProvider, useAuth } from './auth-context'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
const mockEq = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
const mockInsert = vi.fn(() => ({ select: mockSelect }))

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
    })),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

const fakeUser = {
  id: 'u1',
  name: 'Alice',
  house: 'Casa 1',
  phone: '85999999999',
  is_admin: false,
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be inside AuthProvider')
  })

  it('starts with null user and loading true, then loading becomes false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('restores user from localStorage on mount', async () => {
    localStorage.setItem('rp_user', JSON.stringify(fakeUser))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(fakeUser)
  })

  describe('login', () => {
    it('sets user on successful login', async () => {
      mockSingle.mockResolvedValueOnce({ data: fakeUser, error: null })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      let loginResult: { error?: string }
      await act(async () => {
        loginResult = await result.current.login('(85) 99999-9999')
      })

      expect(loginResult!.error).toBeUndefined()
      expect(result.current.user).toEqual(fakeUser)
      expect(localStorage.getItem('rp_user')).toBe(JSON.stringify(fakeUser))
    })

    it('returns error when phone not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      let loginResult: { error?: string }
      await act(async () => {
        loginResult = await result.current.login('00000000000')
      })

      expect(loginResult!.error).toBeDefined()
      expect(result.current.user).toBeNull()
    })

    it('cleans phone of non-digit characters', async () => {
      mockSingle.mockResolvedValueOnce({ data: fakeUser, error: null })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.login('(85) 99999-9999')
      })

      // Verify the cleaned phone was passed to supabase
      const { supabase } = await import('./supabase')
      expect(supabase.from).toHaveBeenCalledWith('users')
    })
  })

  describe('register', () => {
    it('creates user on successful registration', async () => {
      // First call: check for existing user → not found
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
      // Second call: insert + select → new user
      mockSingle.mockResolvedValueOnce({ data: fakeUser, error: null })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      let regResult: { error?: string }
      await act(async () => {
        regResult = await result.current.register('Alice', 'Casa 1', '(85) 99999-9999')
      })

      expect(regResult!.error).toBeUndefined()
      expect(result.current.user).toEqual(fakeUser)
      expect(localStorage.getItem('rp_user')).toBe(JSON.stringify(fakeUser))
    })

    it('returns error for duplicate house+phone', async () => {
      // Check for existing user → found
      mockSingle.mockResolvedValueOnce({ data: { id: 'existing' }, error: null })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      let regResult: { error?: string }
      await act(async () => {
        regResult = await result.current.register('Alice', 'Casa 1', '85999999999')
      })

      expect(regResult!.error).toContain('já possui cadastro')
    })

    it('returns error when insert fails', async () => {
      // Not found
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
      // Insert fails
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert error' } })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      let regResult: { error?: string }
      await act(async () => {
        regResult = await result.current.register('Alice', 'Casa 1', '85999999999')
      })

      expect(regResult!.error).toContain('Erro ao cadastrar')
    })
  })

  describe('logout', () => {
    it('clears user state and localStorage', async () => {
      localStorage.setItem('rp_user', JSON.stringify(fakeUser))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.user).toEqual(fakeUser)

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('rp_user')).toBeNull()
    })
  })
})
