import { supabase } from './supabase';
import { toast } from 'sonner';

// Types
export interface ArrangementData {
  tables: any[];
  seats: any[];
  guests: any[];
}

export interface Arrangement {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  data: ArrangementData;
}

// Default arrangement name
export const DEFAULT_ARRANGEMENT_NAME = 'Christina + Brian Wedding';

// Get the latest arrangement
export async function getLatestArrangement(): Promise<Arrangement | null> {
  try {
    // Get the most recently updated arrangement
    const { data, error } = await supabase
      .from('arrangements')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    // Return the first (most recent) arrangement or null if none exists
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching arrangement:', error);
    return null;
  }
}

// Clean up old arrangements, keeping only the most recent 10
async function cleanupOldArrangements(): Promise<void> {
  try {
    // Get all arrangements ordered by updated_at
    const { data, error } = await supabase
      .from('arrangements')
      .select('id, updated_at')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    // If we have more than 10 arrangements, delete the oldest ones
    if (data && data.length > 10) {
      const arrangementsToDelete = data.slice(10);
      const idsToDelete = arrangementsToDelete.map(arr => arr.id);
      
      // Delete the oldest arrangements
      const { error: deleteError } = await supabase
        .from('arrangements')
        .delete()
        .in('id', idsToDelete);
      
      if (deleteError) throw deleteError;
      
      console.log(`Cleaned up ${idsToDelete.length} old arrangements`);
    }
  } catch (error) {
    console.error('Error cleaning up old arrangements:', error);
  }
}

// Save arrangement data
export async function saveArrangement(data: ArrangementData, silent = false): Promise<boolean> {
  try {
    // Get the latest arrangement
    const latestArrangement = await getLatestArrangement();
    
    if (latestArrangement) {
      // Update existing arrangement
      const { error } = await supabase
        .from('arrangements')
        .update({ 
          data,
          updated_at: new Date().toISOString()
        })
        .eq('id', latestArrangement.id);
      
      if (error) throw error;
      
      if (!silent) {
        toast.success("Arrangement saved", {
          description: "Your seating arrangement has been saved to the cloud."
        });
      }
    } else {
      // Create new arrangement
      const { error } = await supabase
        .from('arrangements')
        .insert({
          name: DEFAULT_ARRANGEMENT_NAME,
          data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      if (!silent) {
        toast.success("Arrangement created", {
          description: "Your seating arrangement has been saved to the cloud."
        });
      }
    }
    
    // Clean up old arrangements after saving
    await cleanupOldArrangements();
    
    return true;
  } catch (error) {
    console.error('Error saving arrangement:', error);
    if (!silent) {
      toast.error("Error saving arrangement", {
        description: "There was a problem saving your seating arrangement."
      });
    }
    return false;
  }
}
