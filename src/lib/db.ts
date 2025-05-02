import { supabase } from './supabase';
import { toast } from 'sonner';
import { SupabaseClient } from '@supabase/supabase-js';

// Types
export interface TableData {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  seats?: (any[] | number); // Allow both array and number to be compatible with Table type
  [key: string]: any; 
}

export interface SeatData {
  id: string;
  tableId: string;
  index?: number; 
  guestId?: (string | null | undefined); 
  position?: ({
    x: number;
    y: number;
    rotation: number;
  } | number); // Allow position to be a number or an object
  [key: string]: any;
}

export interface GuestData {
  id: string;
  name: string;
  [key: string]: any;
}

export interface ArrangementData {
  tables: (TableData[] | any[]);  // Use any[] to accept both Table[] and TableData[]
  seats: (SeatData[] | any[]);   // Use any[] to accept both Seat[] and SeatData[]
  guests: (GuestData[] | any[]);  // Use any[] to accept both Guest[] and GuestData[]
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
export const getLatestArrangement = async (): Promise<Arrangement | null> => {
  try {
    const { data, error } = await supabase
      .from('arrangements')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error fetching arrangement:', error);
      return null;
    }
    
    return data && data.length > 0 ? data[0] as Arrangement : null;
  } catch (error) {
    console.error('Error in getLatestArrangement:', error);
    return null;
  }
};

// Clean up old arrangements, keeping only the most recent 10
export const cleanupOldArrangements = async (): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('arrangements')
      .select('id, updated_at')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching arrangements for cleanup:', error);
      return;
    }
    
    // Keep only the 10 most recent arrangements
    const arrangementsToDelete = data?.slice(10) || [];
    
    if (arrangementsToDelete.length === 0) {
      return; // Nothing to delete
    }
    
    // Extract IDs to delete
    const idsToDelete = arrangementsToDelete.map((arr: { id: string }) => arr.id);
    
    // Delete old arrangements
    const { error: deleteError } = await supabase
      .from('arrangements')
      .delete()
      .in('id', idsToDelete);
    
    if (deleteError) {
      console.error('Error deleting old arrangements:', deleteError);
    }
  } catch (error) {
    console.error('Error in cleanupOldArrangements:', error);
  }
};

// Save arrangement data
export const saveArrangement = async (data: ArrangementData, silent = false): Promise<boolean> => {
  try {
    // First, check if there's an existing arrangement
    const existingArrangement = await getLatestArrangement();
    
    if (existingArrangement) {
      // Update existing arrangement
      const { error } = await supabase
        .from('arrangements')
        .update({
          data,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingArrangement.id);
      
      if (error) {
        console.error('Error updating arrangement:', error);
        if (!silent) {
          toast.error('Failed to save arrangement', {
            description: error.message
          });
        }
        return false;
      }
      
      if (!silent) {
        toast.success('Arrangement saved', {
          description: 'Your seating arrangement has been updated.'
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
      
      if (error) {
        console.error('Error creating arrangement:', error);
        if (!silent) {
          toast.error('Failed to save arrangement', {
            description: error.message
          });
        }
        return false;
      }
      
      if (!silent) {
        toast.success('Arrangement created', {
          description: 'Your seating arrangement has been saved.'
        });
      }
    }
    
    // Clean up old arrangements
    await cleanupOldArrangements();
    
    return true;
  } catch (error) {
    console.error('Error in saveArrangement:', error);
    if (!silent) {
      toast.error('Failed to save arrangement', {
        description: 'An unexpected error occurred.'
      });
    }
    return false;
  }
};
