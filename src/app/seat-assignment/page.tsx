import { getLatestArrangement } from '@/lib/db'
import { SeatAssignment } from '@/components/seat-assignment'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SeatAssignmentPage() {
  // Fetch the latest arrangement data from the server
  const arrangement = await getLatestArrangement()
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Seat Assignment</h1>
      <p className="text-muted-foreground mb-8">
        Assign guests to seats with real-time updates across multiple devices.
        Open this page on another device to see changes in real-time.
      </p>
      
      <SeatAssignment initialArrangement={arrangement} />
    </div>
  )
}
