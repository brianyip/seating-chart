'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Arrangement, ArrangementData, getLatestArrangement } from '@/lib/db'
import { toast } from 'sonner'

export function useRealtimeArrangement(
  initialArrangement: Arrangement | null,
  onUpdate?: (arrangement: Arrangement) => void
) {
  const [arrangement, setArrangement] = useState<Arrangement | null>(initialArrangement)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Set up realtime subscription
  useEffect(() => {
    // Create a channel for listening to changes
    const channel = supabase
      .channel('arrangement-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'arrangements',
        },
        async (payload) => {
          console.log('Received real-time update:', payload)
          
          // Fetch the latest arrangement data
          try {
            setLoading(true)
            const latestArrangement = await getLatestArrangement()
            setLoading(false)
            
            if (latestArrangement) {
              // Update local state
              setArrangement(latestArrangement)
              
              // Call the onUpdate callback if provided
              if (onUpdate) {
                onUpdate(latestArrangement)
              }
              
              // Show a toast notification
              toast.info('Seating arrangement updated', {
                description: 'Changes from another device have been applied'
              })
            }
          } catch (err) {
            console.error('Error fetching updated arrangement:', err)
            setError(err instanceof Error ? err : new Error('Failed to fetch updated arrangement'))
            setLoading(false)
          }
        }
      )
      .subscribe()
    
    // Clean up subscription when component unmounts
    return () => {
      supabase.removeChannel(channel)
    }
  }, [onUpdate])

  return {
    arrangement,
    loading,
    error,
  }
}
