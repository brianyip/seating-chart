'use client'

import { useState, useEffect } from 'react'
import { useRealtimeArrangement } from '@/hooks/use-realtime-arrangement'
import { Arrangement, ArrangementData, SeatData, GuestData, saveArrangementWithVersion } from '@/lib/db'
import { toast } from 'sonner'

interface SeatAssignmentProps {
  initialArrangement: Arrangement | null
}

export function SeatAssignment({ initialArrangement }: SeatAssignmentProps) {
  // Use the real-time hook to get updates
  const { arrangement, loading, error } = useRealtimeArrangement(
    initialArrangement,
    (updatedArrangement) => {
      // This callback runs whenever we receive a real-time update
      console.log('Arrangement updated from another device:', updatedArrangement)
    }
  )

  const [selectedSeat, setSelectedSeat] = useState<SeatData | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<GuestData | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Reset selections if arrangement changes from real-time update
  useEffect(() => {
    setSelectedSeat(null)
    setSelectedGuest(null)
  }, [arrangement?.id, arrangement?.version])

  if (!arrangement) {
    return <div className="p-4">No seating arrangement found</div>
  }

  const seats = arrangement.data.seats || []
  const guests = arrangement.data.guests || []
  const tables = arrangement.data.tables || []

  // Find guest assigned to a seat
  const getAssignedGuest = (seatId: string) => {
    const seat = seats.find(s => s.id === seatId)
    if (!seat || !seat.guestId) return null
    return guests.find(g => g.id === seat.guestId) || null
  }

  // Find table for a seat
  const getTableForSeat = (seatId: string) => {
    const seat = seats.find(s => s.id === seatId)
    if (!seat) return null
    return tables.find(t => t.id === seat.tableId) || null
  }

  // Assign guest to seat with version control
  const assignGuestToSeat = async (seatId: string, guestId: string | null) => {
    if (!arrangement || !arrangement.id || isSaving) return
    
    try {
      setIsSaving(true)
      
      // Create a copy of the current arrangement data
      const updatedData: ArrangementData = JSON.parse(JSON.stringify(arrangement.data))
      
      // Find the seat and update it
      const seatIndex = updatedData.seats.findIndex(seat => seat.id === seatId)
      if (seatIndex >= 0) {
        // Update the guest ID
        updatedData.seats[seatIndex] = {
          ...updatedData.seats[seatIndex],
          guestId
        }
        
        // If this guest was assigned to another seat, unassign them
        if (guestId) {
          const previousSeatIndex = updatedData.seats.findIndex(
            seat => seat.id !== seatId && seat.guestId === guestId
          )
          
          if (previousSeatIndex >= 0) {
            updatedData.seats[previousSeatIndex] = {
              ...updatedData.seats[previousSeatIndex],
              guestId: null
            }
          }
        }
        
        // Save with version control
        const currentVersion = arrangement.version || 1
        const result = await saveArrangementWithVersion(
          updatedData,
          arrangement.id,
          currentVersion
        )
        
        if (result.conflict) {
          // Handle conflict - the UI will update automatically via the real-time subscription
          toast.warning('Seating chart was updated by another device', {
            description: 'Your changes were not applied. The latest data has been loaded.'
          })
        }
      }
    } catch (error) {
      console.error('Error assigning guest to seat:', error)
      toast.error('Failed to assign guest', {
        description: 'Please try again'
      })
    } finally {
      setIsSaving(false)
      setSelectedSeat(null)
      setSelectedGuest(null)
    }
  }

  return (
    <div className="p-4 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{arrangement.name}</h2>
        {loading && <div className="text-sm text-muted-foreground">Syncing changes...</div>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Seats section */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Tables & Seats</h3>
          <div className="space-y-6">
            {tables.map(table => (
              <div key={table.id} className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">{table.name}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {seats
                    .filter(seat => seat.tableId === table.id)
                    .map(seat => {
                      const assignedGuest = getAssignedGuest(seat.id)
                      const isSelected = selectedSeat?.id === seat.id
                      
                      return (
                        <button
                          key={seat.id}
                          className={`p-2 rounded text-left ${
                            isSelected 
                              ? 'bg-primary text-primary-foreground' 
                              : assignedGuest 
                                ? 'bg-secondary text-secondary-foreground' 
                                : 'bg-muted'
                          }`}
                          onClick={() => setSelectedSeat(seat)}
                          disabled={isSaving}
                        >
                          <div className="text-sm font-medium">Seat {seat.index || ''}</div>
                          {assignedGuest && (
                            <div className="text-xs truncate">{assignedGuest.name}</div>
                          )}
                        </button>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Guests section */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Guests</h3>
          <div className="grid grid-cols-2 gap-2">
            {guests.map(guest => {
              // Find if guest is already assigned
              const assignedSeat = seats.find(seat => seat.guestId === guest.id)
              const assignedTable = assignedSeat ? getTableForSeat(assignedSeat.id) : null
              const isSelected = selectedGuest?.id === guest.id
              
              return (
                <button
                  key={guest.id}
                  className={`p-2 rounded text-left ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : assignedSeat 
                        ? 'bg-secondary text-secondary-foreground' 
                        : 'bg-muted'
                  }`}
                  onClick={() => setSelectedGuest(guest)}
                  disabled={isSaving}
                >
                  <div className="text-sm font-medium">{guest.name}</div>
                  {assignedTable && (
                    <div className="text-xs truncate">
                      {assignedTable.name} - Seat {assignedSeat?.index || ''}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Assignment actions */}
      {selectedSeat && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <h3 className="text-lg font-medium mb-2">
            {selectedSeat && `Seat ${selectedSeat.index || ''} at ${getTableForSeat(selectedSeat.id)?.name || ''}`}
          </h3>
          
          {selectedGuest ? (
            <div className="flex space-x-2">
              <button
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
                onClick={() => assignGuestToSeat(selectedSeat.id, selectedGuest.id)}
                disabled={isSaving}
              >
                {isSaving ? 'Assigning...' : `Assign ${selectedGuest.name} to this seat`}
              </button>
              <button
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md"
                onClick={() => setSelectedGuest(null)}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex space-x-2">
              <button
                className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md"
                onClick={() => assignGuestToSeat(selectedSeat.id, null)}
                disabled={isSaving || !getAssignedGuest(selectedSeat.id)}
              >
                {isSaving ? 'Removing...' : 'Remove assigned guest'}
              </button>
              <button
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md"
                onClick={() => setSelectedSeat(null)}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
