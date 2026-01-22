import { useState, useEffect, useCallback } from 'react'

export interface Font {
  id: string
  name: string
  family: string
  filename: string
  fileUrl: string
  createdAt: string
}

export function useFonts() {
  const [fonts, setFonts] = useState<Font[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFonts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/fonts')
      if (!response.ok) throw new Error('Failed to fetch fonts')
      const data = await response.json()
      setFonts(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fonts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFonts()
  }, [fetchFonts])

  const uploadFont = async (file: File, name: string): Promise<Font | null> => {
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)

      const response = await fetch('/api/fonts', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload font')
      }

      const font = await response.json()
      
      await fetchFonts()
      return font
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload font')
      return null
    } finally {
      setLoading(false)
    }
  }

  const deleteFont = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/fonts?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete font')
      
      setFonts(prev => prev.filter(f => f.id !== id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete font')
      return false
    }
  }

  return {
    fonts,
    loading,
    error,
    fetchFonts,
    uploadFont,
    deleteFont,
  }
}
