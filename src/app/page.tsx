"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAlertNotification } from "@/components/ui/alert-notification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  Lock,
  Unlock,
  Search,
  Loader2,
  RefreshCw,
  Grid,
  AlertTriangle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getLatestArrangement, saveArrangement } from '@/lib/db';
import { guestListData } from '@/data/guests';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Define the Guest type
interface Guest {
  id: string;
  name: string;
  assignedSeatId?: string;
}

// Define the Seat type
interface Seat {
  id: string;
  tableId: string;
  position: number;
  guestId?: string;
}

// Define the Table type
interface Table {
  id: string;
  x: number;
  y: number;
  name: string;
  seats: number;
  type: "circle" | "rectangle";
  // For rectangle tables
  width?: number;
  height?: number;
}

// Generate positions for seats around a circular table
const generateCircularSeatPositions = (seats: number, tableRadius: number = 40) => {
  const positions = [];
  const seatDistance = tableRadius + 12; // Reduced distance for better spacing
  const badgeDistance = tableRadius + 24; // Reduced distance for badges from center
  
  for (let i = 0; i < seats; i++) {
    const angle = (i * 2 * Math.PI) / seats;
    const x = seatDistance * Math.cos(angle);
    const y = seatDistance * Math.sin(angle);
    
    // Calculate badge offset
    const badgeX = badgeDistance * Math.cos(angle);
    const badgeY = badgeDistance * Math.sin(angle);
    
    // Calculate rotation angle for the seat (pointing toward the table)
    const rotation = (angle * 180) / Math.PI - 90; // Convert to degrees and adjust to point inward
    positions.push({ 
      x, 
      y, 
      rotation, 
      position: i,
      badgeOffset: { 
        x: badgeX - x, 
        y: badgeY - y 
      }
    });
  }
  
  return positions;
};

// Generate positions for seats around a rectangular table
const generateRectangularSeatPositions = (seats: number, width: number = 70, height: number = 140) => {
  const positions = [];
  
  // Calculate how many seats on each side
  // For a rectangular table, we'll place seats on the long sides
  const seatsPerSide = Math.floor(seats / 2);
  const remainingSeats = seats - (seatsPerSide * 2);
  
  // Calculate spacing between seats on each side
  const longSideLength = height;
  
  const longSideSpacing = longSideLength / (seatsPerSide + 1);
  
  // Left side seats
  for (let i = 0; i < seatsPerSide; i++) {
    const y = -height/2 + longSideSpacing * (i + 1);
    const x = -width/2 - 15; // 15px offset from table edge
    positions.push({ 
      x, 
      y, 
      rotation: 90, // Point toward table
      position: i,
      badgeOffset: { x: -15, y: 0 } // Badge offset for left side
    });
  }
  
  // Right side seats
  for (let i = 0; i < seatsPerSide; i++) {
    const y = -height/2 + longSideSpacing * (i + 1);
    const x = width/2 + 15; // 15px offset from table edge
    positions.push({ 
      x, 
      y, 
      rotation: 270, // Point toward table
      position: seatsPerSide + i,
      badgeOffset: { x: 15, y: 0 } // Badge offset for right side
    });
  }
  
  // If there are remaining seats, add them to the ends
  if (remainingSeats > 0) {
    // Top end
    positions.push({
      x: 0,
      y: -height/2 - 15,
      rotation: 0,
      position: seatsPerSide * 2,
      badgeOffset: { x: 0, y: -40 } // Badge offset for top
    });
    
    // Bottom end (if needed)
    if (remainingSeats > 1) {
      positions.push({
        x: 0,
        y: height/2 + 15,
        rotation: 180,
        position: seatsPerSide * 2 + 1,
        badgeOffset: { x: 0, y: 40 } // Badge offset for bottom
      });
    }
  }
  
  return positions;
};

// Generate a color based on table ID for consistent colors
const getTableColor = (tableId: string) => {
  // Simple hash function to generate a consistent color from table ID
  const hash = tableId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 95%)`; // Light pastel color
};

// Guest list data is imported from @/data/guests

// Add this configuration to make the page client-side only
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default function Home() {
  const [tables, setTables] = useState<Table[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTable, setCurrentTable] = useState<string | null>(null);
  const [highlightedSeatId, setHighlightedSeatId] = useState<string | null>(null);
  const [tablesLocked, setTablesLocked] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const gridSize = 20; // Fixed grid size in pixels
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Canvas panning state
  const [isPanning, setIsPanning] = useState(false);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  // Track visible tables for dynamic canvas boundaries
  const [visibleBounds, setVisibleBounds] = useState({ minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 });
  
  // Initialize guest list from data or load from Supabase
  useEffect(() => {
    // Load the arrangement from Supabase
    const loadArrangement = async () => {
      setIsLoading(true);
      try {
        const arrangement = await getLatestArrangement();
        
        if (arrangement) {
          // Cast through unknown to satisfy TypeScript
          setTables(arrangement.data.tables as unknown as Table[]);
          setSeats(arrangement.data.seats as unknown as Seat[]);
          setGuests(arrangement.data.guests as unknown as Guest[]);
          setLastSaved(new Date(arrangement.updated_at));
          alert.success("Arrangement loaded", "The seating arrangement has been loaded from the cloud.");
        } else {
          console.log("No arrangement found in Supabase, checking localStorage...");
          // Load saved data if available (fallback to localStorage)
          const savedData = localStorage.getItem('weddingSeatingArrangement');
          
          if (savedData) {
            try {
              const { tables: savedTables, seats: savedSeats, guests: savedGuests } = JSON.parse(savedData);
              setTables(savedTables);
              setSeats(savedSeats);
              
              // Merge saved guests with the original guest list
              const savedGuestIds = new Set(savedGuests.map((g: Guest) => g.id));
              
              // Create the initial guest list, excluding any that are already in the saved list
              const initialGuests = guestListData.map((name, index) => {
                const id = `guest-${index}`;
                return { id, name };
              }).filter(g => !savedGuestIds.has(g.id));
              
              setGuests([...savedGuests, ...initialGuests]);
              alert.info("Using local data", "Loaded from browser storage. Changes will sync to the cloud.");
            } catch (error) {
              console.error("Error loading saved data:", error);
              initializeGuestList();
              alert.error("Error loading saved data", "Starting with a fresh seating arrangement.");
            }
          } else {
            console.log("No localStorage data found, initializing fresh guest list");
            initializeGuestList();
            alert.info("Started new arrangement", "No previous arrangement found. Changes will be saved to the cloud.");
          }
        }
      } catch (error) {
        console.error("Error in loadArrangement:", error);
        // Fallback to localStorage if Supabase fails
        const savedData = localStorage.getItem('weddingSeatingArrangement');
        
        if (savedData) {
          try {
            const { tables: savedTables, seats: savedSeats, guests: savedGuests } = JSON.parse(savedData);
            setTables(savedTables);
            setSeats(savedSeats);
            
            // Merge saved guests with the original guest list
            const savedGuestIds = new Set(savedGuests.map((g: Guest) => g.id));
            
            // Create the initial guest list, excluding any that are already in the saved list
            const initialGuests = guestListData.map((name, index) => {
              const id = `guest-${index}`;
              return { id, name };
            }).filter(g => !savedGuestIds.has(g.id));
            
            setGuests([...savedGuests, ...initialGuests]);
            alert.warning("Cloud connection failed", "Using local data. Check your internet connection.");
          } catch (error) {
            console.error("Error loading saved data:", error);
            initializeGuestList();
            alert.error("Error loading data", "Starting with a fresh seating arrangement.");
          }
        } else {
          initializeGuestList();
          alert.error("Cloud connection failed", "Starting with a fresh seating arrangement.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadArrangement();
  }, []);

  // Initialize guest list
  const initializeGuestList = () => {
    const initialGuests = guestListData.map((name, index) => {
      return { id: `guest-${index}`, name };
    });
    setGuests(initialGuests);
  };
  
  // Handle auto-save with indicator
  const handleAutoSave = useCallback(async () => {
    // Only save if there are tables
    if (tables.length === 0) return;
    
    setIsAutoSaving(true);
    const data = {
      tables,
      seats,
      guests
    };
    
    // Save to localStorage as a backup
    try {
      localStorage.setItem('weddingSeatingArrangement', JSON.stringify(data));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
    
    // Save to Supabase
    const success = await saveArrangement(data, true);
    
    if (success) {
      setLastSaved(new Date());
    }
    
    setIsAutoSaving(false);
  }, [tables, seats, guests]);

  // Auto-save to Supabase every 30 seconds if there are changes
  useEffect(() => {
    // Skip the first render
    if (tables.length === 0 && seats.length === 0) return;
    
    const autoSaveInterval = setInterval(() => {
      handleAutoSave();
    }, 30000); // 30 seconds
    
    return () => clearInterval(autoSaveInterval);
  }, [tables, seats, guests, handleAutoSave]);

  // Save the current arrangement (manual save)
  const handleSaveArrangement = async () => {
    const data = {
      tables,
      seats,
      guests
    };
    
    // Also save to localStorage as a backup
    try {
      localStorage.setItem('weddingSeatingArrangement', JSON.stringify(data));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
    
    // Only save to Supabase if there are tables
    if (tables.length > 0) {
      setIsLoading(true);
      const success = await saveArrangement(data, false);
      setIsLoading(false);
      
      if (success) {
        setLastSaved(new Date());
      }
    }
  };

  // Force refresh the arrangement from Supabase
  const forceRefreshArrangement = async () => {
    try {
      setIsLoading(true);
      // Check if there are unsaved changes
      const hasChanges = localStorage.getItem('seatingArrangement') !== null;
      
      if (hasChanges) {
        // Confirm with the user if they want to discard changes
        if (!window.confirm("You have unsaved changes. Refreshing will discard these changes. Continue?")) {
          setIsLoading(false);
          return;
        }
      }
      
      const arrangement = await getLatestArrangement();
      
      if (arrangement) {
        console.log("Arrangement force refreshed from Supabase:", arrangement);
        setTables(arrangement.data.tables as unknown as Table[]);
        setSeats(arrangement.data.seats as unknown as Seat[]);
        setGuests(arrangement.data.guests as unknown as Guest[]);
        setLastSaved(new Date(arrangement.updated_at));
        alert.success("Arrangement refreshed", "The latest version has been loaded from the cloud.");
      } else {
        alert.warning("No arrangement found", "Could not find any saved arrangement in the cloud.");
      }
    } catch (error) {
      console.error("Error refreshing arrangement:", error);
      alert.error("Refresh failed", "Could not load the latest version from the cloud.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new circular table
  const addCircleTable = () => {
    const newTableId = `table-${Date.now()}`;
    const newTable: Table = {
      id: newTableId,
      x: 300,
      y: 300,
      name: `Table ${tables.length + 1}`,
      seats: 10,
      type: "circle"
    };
    
    // Create seats for the new table
    const newSeats = Array.from({ length: newTable.seats }).map((_, index) => ({
      id: `seat-${newTableId}-${index}`,
      tableId: newTableId,
      position: index
    }));
    
    setTables([...tables, newTable]);
    setSeats([...seats, ...newSeats]);
  };

  // Add a new rectangular table
  const addRectangleTable = () => {
    const newTableId = `table-${Date.now()}`;
    const newTable: Table = {
      id: newTableId,
      x: 100,
      y: 100,
      name: `Table ${tables.length + 1}`,
      seats: 8,
      type: "rectangle",
      width: 70,
      height: 105
    };
    
    // Create seats for the new table
    const newSeats = Array.from({ length: newTable.seats }).map((_, index) => ({
      id: `seat-${newTableId}-${index}`,
      tableId: newTableId,
      position: index
    }));
    
    setTables([...tables, newTable]);
    setSeats([...seats, ...newSeats]);
  };

  // Handle mouse down on a table
  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    // If tables are locked, don't allow dragging
    if (tablesLocked) return;
    
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to canvas
    setIsDragging(true);
    setCurrentTable(tableId);
    setSelectedTableId(tableId); // Set the selected table
  };

  // Handle mouse move for table dragging only (panning removed)
  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle table dragging
    if (isDragging && currentTable && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      // Calculate position relative to the canvas and adjust for panning and scaling
      let x = (e.clientX - canvasRect.left - canvasPosition.x) / canvasScale;
      let y = (e.clientY - canvasRect.top - canvasPosition.y) / canvasScale;
      
      // Get current table dimensions
      const tableObj = tables.find(t => t.id === currentTable);
      if (!tableObj) return;
      
      // Always snap to invisible 20px grid
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
      
      // Update the table position
      setTables(tables.map(table => 
        table.id === currentTable 
          ? { ...table, x, y } 
          : table
      ));
      
      // Update visible bounds if table is moved beyond current bounds
      updateVisibleBounds(x, y);
    }
    
    // Canvas panning with mouse drag has been removed
    // The canvas can now only be panned using trackpad or mouse wheel
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setCurrentTable(null);
    setIsPanning(false);
    // Note: We don't clear selectedTableId here to keep the selection visible
  };
  
  // Handle canvas mouse down - now only used to clear table selection
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // If clicking on empty canvas while a table is selected, clear the selection
    if (e.button === 0 && !isDragging) {
      setSelectedTableId(null);
    }
  };
  
  // Handle wheel events for panning with trackpad/mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    // Prevent default scrolling behavior
    e.preventDefault();
    
    // Only handle wheel events if not dragging a table and no table is selected
    if (isDragging || isPanning || selectedTableId) return;
    
    // Adjust the canvas position based on wheel delta
    // For trackpads, this provides a natural panning experience
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;
    
    // Adjust sensitivity based on canvas scale
    const sensitivity = 1 / canvasScale;
    
    setCanvasPosition({
      x: canvasPosition.x - deltaX * sensitivity,
      y: canvasPosition.y - deltaY * sensitivity
    });
    
    // Log panning for debugging
    console.log('Panning with wheel:', { deltaX, deltaY, newPosition: {
      x: canvasPosition.x - deltaX * sensitivity,
      y: canvasPosition.y - deltaY * sensitivity
    }});
  };
  
  // Update visible bounds based on table positions or viewport changes
  const updateVisibleBounds = (x?: number, y?: number) => {
    setVisibleBounds(prev => {
      // Create a buffer around the current bounds
      const buffer = 500;
      
      // If x and y are provided (table being dragged), check if they're outside current bounds
      if (x !== undefined && y !== undefined) {
        return {
          minX: Math.min(prev.minX, x - buffer),
          minY: Math.min(prev.minY, y - buffer),
          maxX: Math.max(prev.maxX, x + buffer),
          maxY: Math.max(prev.maxY, y + buffer)
        };
      }
      
      // Otherwise, update based on all table positions
      if (tables.length > 0) {
        const tableXPositions = tables.map(t => t.x);
        const tableYPositions = tables.map(t => t.y);
        
        const minTableX = Math.min(...tableXPositions);
        const maxTableX = Math.max(...tableXPositions);
        const minTableY = Math.min(...tableYPositions);
        const maxTableY = Math.max(...tableYPositions);
        
        return {
          minX: Math.min(prev.minX, minTableX - buffer),
          minY: Math.min(prev.minY, minTableY - buffer),
          maxX: Math.max(prev.maxX, maxTableX + buffer),
          maxY: Math.max(prev.maxY, maxTableY + buffer)
        };
      }
      
      return prev;
    });
  };
  
  // Reset canvas view to center
  const resetCanvasView = () => {
    setCanvasPosition({ x: 0, y: 0 });
    setCanvasScale(1);
    // Reset visible bounds to default
    setVisibleBounds({ minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 });
  };

  // Open dialog to edit table
  const openEditDialog = (table: Table) => {
    setEditingTable({...table});
    setIsDialogOpen(true);
  };

  // Save table edits
  const saveTableEdits = () => {
    if (!editingTable) return;
    
    // Get current table seats
    const currentTableSeats = seats.filter(seat => seat.tableId === editingTable.id);
    
    // Handle seat count changes
    if (editingTable.seats !== currentTableSeats.length) {
      if (editingTable.seats > currentTableSeats.length) {
        // Add more seats
        const newSeats = Array.from({ length: editingTable.seats - currentTableSeats.length }).map((_, index) => ({
          id: `seat-${editingTable.id}-${currentTableSeats.length + index}`,
          tableId: editingTable.id,
          position: currentTableSeats.length + index
        }));
        setSeats([...seats, ...newSeats]);
      } else if (editingTable.seats < currentTableSeats.length) {
        // Remove excess seats and unassign any guests
        // Get IDs of seats to remove
        const seatIdsToRemove = new Set(
          currentTableSeats.slice(editingTable.seats).map(seat => seat.id)
        );
        
        // Update seats array to remove the excess seats
        setSeats(seats.filter(seat => !seatIdsToRemove.has(seat.id)));
      }
    }
    
    // Update the table
    setTables(tables.map(table => 
      table.id === editingTable.id 
        ? editingTable 
        : table
    ));
    
    // Close the dialog
    setIsDialogOpen(false);
  };

  // Delete a table
  const deleteTable = (tableId: string) => {
    // Find all seats for this table
    const tableSeats = seats.filter(seat => seat.tableId === tableId);
    
    // Remove the table
    setTables(tables.filter(table => table.id !== tableId));
    
    // Remove all seats for this table
    setSeats(seats.filter(seat => seat.tableId !== tableId));
    
    // Close the dialog
    setIsDialogOpen(false);
    
    // Show a toast notification
    alert.info("Table deleted", `Table and ${tableSeats.length} seats have been removed`);
  };

  // State to track the currently dragged guest name
  const [draggedGuestName, setDraggedGuestName] = useState<string>('');
  
  // State to track mouse position during drag
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // State to track if we're currently dragging
  const [isDraggingGuest, setIsDraggingGuest] = useState(false);
  
  // Update mouse position on mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingGuest) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDraggingGuest]);
  
  // Handle guest drag start
  const handleGuestDragStart = (e: React.DragEvent, guestId: string) => {
    // Set the data being dragged - this is critical for the drop to work
    e.dataTransfer.setData('application/json', JSON.stringify({ guestId }));
    e.dataTransfer.effectAllowed = 'move';
    
    // Find the guest data
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;
    
    // Set the dragged guest name and initial mouse position
    setDraggedGuestName(guest.name);
    setMousePosition({ x: e.clientX, y: e.clientY });
    setIsDraggingGuest(true);
    
    // Use a transparent image as the drag image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Transparent 1x1 pixel
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  // Handle guest drag end
  const handleGuestDragEnd = () => {
    // Reset dragging state
    setIsDraggingGuest(false);
    setDraggedGuestName('');
  };
  
  // Handle drag over for the entire document
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      // Prevent default to allow drop
      e.preventDefault();
      
      // Update mouse position during drag
      if (isDraggingGuest) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    };
    
    document.addEventListener('dragover', handleDragOver);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
    };
  }, [isDraggingGuest]);

  // Handle seat drag over
  const handleSeatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Get the seat ID from the current target
    const seatId = e.currentTarget.getAttribute('data-seat-id');
    if (seatId) {
      setHighlightedSeatId(seatId);
    }
  };

  // Handle seat drag leave
  const handleSeatDragLeave = () => {
    setHighlightedSeatId(null);
  };

  // Handle seat drop
  const handleSeatDrop = (e: React.DragEvent, seatId: string) => {
    e.preventDefault();
    setHighlightedSeatId(null);
    
    // Reset dragging state immediately
    setIsDraggingGuest(false);
    setDraggedGuestName('');
    
    // Get the dragged data
    const dataString = e.dataTransfer.getData('application/json');
    if (!dataString) return;
    
    try {
      const { guestId } = JSON.parse(dataString);
      if (!guestId) return;
    
    // Check if the guest is already assigned to another seat
    const currentSeat = seats.find(seat => seat.guestId === guestId);
    
    // If dropping onto the same seat, do nothing
    if (currentSeat?.id === seatId) return;
    
    // Create a new seats array to make updates
    const updatedSeats = [...seats];
    
    // Get the target seat and check if it already has a guest
    const targetSeatIndex = updatedSeats.findIndex(seat => seat.id === seatId);
    if (targetSeatIndex === -1) return; // Seat not found
    
    const targetSeat = updatedSeats[targetSeatIndex];
    const targetGuestId = targetSeat.guestId;
    
    // First, handle the current seat if the guest is already seated
    if (currentSeat) {
      // Find the index of the current seat
      const currentSeatIndex = updatedSeats.findIndex(seat => seat.id === currentSeat.id);
      if (currentSeatIndex !== -1) {
        // If the target seat has a guest and we're swapping
        if (targetGuestId) {
          // Swap: Move the target seat's guest to the current seat
          updatedSeats[currentSeatIndex] = { ...updatedSeats[currentSeatIndex], guestId: targetGuestId };
          
          // Show swap notification
          const movingGuest = guests.find(g => g.id === guestId);
          const displacedGuest = guests.find(g => g.id === targetGuestId);
          if (movingGuest && displacedGuest) {
            alert.success(`Guests swapped`, `${movingGuest.name} and ${displacedGuest.name} have swapped seats`);
          }
        } else {
          // No guest at target: Just remove from current seat
          updatedSeats[currentSeatIndex] = { ...updatedSeats[currentSeatIndex], guestId: undefined };
        }
      }
    }
    
    // Then, assign the dragged guest to the target seat
    updatedSeats[targetSeatIndex] = { ...updatedSeats[targetSeatIndex], guestId };
    
    // Update the seats state
    setSeats(updatedSeats);
    
    // Show a toast notification when a guest is moved (if not a swap)
    if (!targetGuestId) {
      const guest = guests.find(g => g.id === guestId);
      if (guest) {
        if (currentSeat) {
          alert.success(`${guest.name} moved`, "Guest has been moved to a new seat");
        } else {
          alert.success(`${guest.name} seated`, "Guest has been assigned to a seat");
        }
      }
    }
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  };

  // Helper function to get last name - defined inside component to avoid dependency issues
  const getLastNameForSort = (fullName: string) => {
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  // Get unassigned guests
  const filteredUnassignedGuests = useMemo(() => {
    // Get all assigned guest IDs
    const assignedGuestIds = new Set(
      seats
        .filter(seat => seat.guestId)
        .map(seat => seat.guestId as string)
    );
    
    // Get unassigned guests
    const unassignedGuestsList = guests.filter(guest => !assignedGuestIds.has(guest.id));
    
    // Apply search filter if there's a query
    let filteredGuests;
    if (searchQuery.trim() === '') {
      filteredGuests = unassignedGuestsList;
    } else {
      const query = searchQuery.toLowerCase().trim();
      filteredGuests = unassignedGuestsList.filter(guest => 
        guest.name.toLowerCase().includes(query)
      );
    }
    
    // Sort by last name
    return [...filteredGuests].sort((a, b) => {
      const lastNameA = getLastNameForSort(a.name).toLowerCase();
      const lastNameB = getLastNameForSort(b.name).toLowerCase();
      return lastNameA.localeCompare(lastNameB);
    });
  }, [guests, seats, searchQuery]);

  // Handle Clear All button click - now just clears guest assignments
  const handleClearAll = () => {
    // Keep tables but clear all guest assignments
    const updatedSeats = seats.map(seat => ({
      ...seat,
      guestId: undefined
    }));
    
    setSeats(updatedSeats);
    
    // Show a toast notification
    alert.info("All guests unassigned", "All guests have been returned to the unassigned list");
  };

  // Initialize the canvas with tables in the center of the view
  useEffect(() => {
    // Set initial canvas position to center the content
    const centerX = 250;
    const centerY = 250;
    setCanvasPosition({ x: centerX, y: centerY });
    
    // Add a default table if none exist
    if (tables.length === 0) {
      addCircleTable();
    } else {
      // Update visible bounds based on existing tables
      updateVisibleBounds();
    }
    
    // Log initial setup
    console.log('Canvas initialized with position:', { x: centerX, y: centerY });
  }, []);
  
  // Update visible bounds when tables change
  useEffect(() => {
    if (tables.length > 0) {
      updateVisibleBounds();
    }
  }, [tables.length]);
  
  // Add event listeners for mouse up outside the canvas and prevent browser back/forward navigation
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setCurrentTable(null);
      }
      if (isPanning) {
        setIsPanning(false);
      }
    };
    
    // Prevent browser back/forward navigation when using horizontal swipe gestures
    const preventBrowserNavigation = (e: WheelEvent) => {
      // Check if event target is within our canvas
      if (canvasRef.current?.contains(e.target as Node)) {
        // Always prevent default to stop browser navigation
        e.preventDefault();
        
        // Handle wheel event for panning
        const deltaX = e.deltaX;
        const deltaY = e.deltaY;
        const sensitivity = 1 / canvasScale;
        
        setCanvasPosition(prev => ({
          x: prev.x - deltaX * sensitivity,
          y: prev.y - deltaY * sensitivity
        }));
        
        // Log wheel event for debugging
        console.log('Wheel event handled', { deltaX, deltaY });
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    // Use passive: false to allow preventDefault in the wheel event handler
    window.addEventListener('wheel', preventBrowserNavigation, { passive: false });
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('wheel', preventBrowserNavigation);
    };
  }, [isDragging, isPanning]);

  // Get first name of a guest
  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0];
  };
  
  // Get last name of a guest
  const getLastName = (fullName: string) => {
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };
  
  // Format name as "First Name + first character of Last Name"
  const getFormattedName = (fullName: string) => {
    const firstName = getFirstName(fullName);
    const lastName = getLastName(fullName);
    
    if (lastName) {
      return `${firstName} ${lastName.charAt(0)}`;
    }
    
    return firstName;
  };

  // Use our new alert notification system
  const alert = useAlertNotification();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Drag ghost element */}
      {isDraggingGuest && draggedGuestName && (
        <div 
          className="fixed px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full shadow-md border border-primary/20 pointer-events-none z-[9999] whitespace-nowrap"
          style={{ 
            left: `${mousePosition.x + 15}px`, 
            top: `${mousePosition.y + 15}px`,
            transform: 'translate(0, 0)' // Force GPU acceleration
          }}
        >
          {draggedGuestName}
        </div>
      )}
      {/* Guest List - Fixed Position */}
      <div className="fixed left-0 top-0 w-[280px] h-full bg-white border-r z-10 overflow-y-auto">
        <Card className="border-0 rounded-none h-full">
          <CardHeader>
            <CardTitle>Guest List</CardTitle>
            <CardDescription>
              {filteredUnassignedGuests.length} unassigned guests
            </CardDescription>

          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search guests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-2">
                {filteredUnassignedGuests.length > 0 ? (
                  <div className="space-y-1.5">
                    {filteredUnassignedGuests.map(guest => (
                      <div key={guest.id} className="flex items-center w-full">
                        <Badge
                          variant="outline"
                          className="w-full px-3 py-1.5 text-sm cursor-move hover:bg-primary/10 transition-colors justify-between flex items-center"
                          draggable
                          onDragStart={(e) => handleGuestDragStart(e, guest.id)}
                          onDragEnd={handleGuestDragEnd}
                        >
                          <span className="truncate">{guest.name}</span>
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    {searchQuery ? 'No matching guests found' : 'All guests are seated'}
                  </div>
                )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area with Canvas */}
      <main className="absolute inset-0 ml-[280px] mr-[280px] overflow-hidden">
            
        {/* Canvas for floor plan */}
        <div 
          ref={canvasRef}
          className={`w-full h-full bg-gray-50 overflow-hidden ${selectedTableId ? 'cursor-default' : 'cursor-move'}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          // Prevent context menu to avoid interference with panning
          onContextMenu={(e) => e.preventDefault()}
        >
              {/* Inner canvas container with transform for panning */}
              <div
                className="absolute"
                style={{
                  width: `${visibleBounds.maxX - visibleBounds.minX + 4000}px`,
                  height: `${visibleBounds.maxY - visibleBounds.minY + 4000}px`,
                  transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasScale})`,
                  transformOrigin: '0 0'
                }}
              >
                {/* Grid removed, but snapping still active */}
                {tables.map((table) => {
                // Generate seat positions based on table type
                const seatPositions = table.type === "circle" 
                  ? generateCircularSeatPositions(table.seats)
                  : generateRectangularSeatPositions(
                      table.seats, 
                      table.width || 70, 
                      table.height || 140
                    );
                
                return (
                  <div
                    key={table.id}
                    className={`absolute ${!tablesLocked ? 'cursor-move' : 'cursor-default'}`}
                    style={{
                      left: `${table.x}px`,
                      top: `${table.y}px`,
                      transform: 'translate(-50%, -50%)',
                      touchAction: 'none'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, table.id)}
                    onDoubleClick={() => openEditDialog(table)}
                  >
                    {/* Selection box */}
                    {selectedTableId === table.id && (
                      <div 
                        className="absolute border-2 border-primary rounded-lg pointer-events-none"
                        style={{
                          width: table.type === "circle" ? '96px' : `${(table.width || 70) + 16}px`,
                          height: table.type === "circle" ? '96px' : `${(table.height || 140) + 16}px`,
                          left: '0',
                          top: '0',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 20,
                          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)',
                        }}
                      />
                    )}
                    {/* Seats */}
                    {seatPositions.map((position, index) => {
                      // Find the corresponding seat data
                      const seatId = `seat-${table.id}-${position.position}`;
                      const seatData = seats.find(s => s.id === seatId);
                      const guestId = seatData?.guestId;
                      const guest = guests.find(g => g.id === guestId);
                      
                      return (
                        <div
                          key={`${table.id}-seat-${index}`}
                          className="absolute"
                          style={{
                            left: `${position.x}px`,
                            top: `${position.y}px`,
                            zIndex: 5,
                          }}
                          data-seat-id={seatId}
                          onDragOver={handleSeatDragOver}
                          onDragLeave={handleSeatDragLeave}
                          onDrop={(e) => handleSeatDrop(e, seatId)}
                        >
                          {guest ? (
                            // Guest assigned - show guest name in badge
                            <div 
                              className="absolute"
                              style={{
                                left: `${position.badgeOffset?.x || 0}px`,
                                top: `${position.badgeOffset?.y || 0}px`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 15,
                                whiteSpace: 'nowrap'
                              }}
                              draggable
                              onDragStart={(e) => handleGuestDragStart(e, guest.id)}
                              onDragEnd={handleGuestDragEnd}
                            >
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      className="text-xs px-2 py-0.5 font-medium cursor-move" 
                                      style={{
                                        backgroundColor: '#fbcfe8',
                                        color: 'rgba(0, 0, 0, 0.8)',
                                        border: '1px solid rgba(0, 0, 0, 0.1)',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                        minWidth: '50px',
                                        textAlign: 'center',
                                        display: 'inline-block',
                                        fontSize: '10px',
                                        padding: '1px 4px'
                                      }}
                                    >
                                      {getFormattedName(guest.name)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{guest.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          ) : (
                            // No guest - show empty seat
                            <div
                              className={`bg-white border shadow-sm transition-all duration-200 ${highlightedSeatId === seatId ? 'border-primary border-2 ring-2 ring-primary/30' : 'border-gray-400'}`}
                              style={{
                                width: '20px',
                                height: '20px',
                                transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
                                borderTopLeftRadius: '0px',
                                borderTopRightRadius: '0px',
                                borderBottomLeftRadius: '10px',
                                borderBottomRightRadius: '10px',
                                borderWidth: highlightedSeatId === seatId ? '2px' : '1.5px',
                                backgroundColor: highlightedSeatId === seatId ? '#f0f9ff' : '#ffffff',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Table - Circle or Rectangle */}
                    {table.type === "circle" ? (
                      <div 
                        className="absolute rounded-full bg-white border-2 border-gray-400 flex flex-col items-center justify-center shadow-md"
                        style={{
                          width: '80px',
                          height: '80px',
                          left: '0',
                          top: '0',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: getTableColor(table.id),
                        }}
                      >
                        <div className="flex flex-col items-center justify-center w-full h-full">
                          <div className="font-medium text-gray-700 text-xs">{table.seats} people</div>
                          <div className="text-3xl font-bold text-gray-800">{table.name.replace(/Table /i, '')}</div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="absolute bg-white border-2 border-gray-400 flex flex-col items-center justify-center shadow-md"
                        style={{
                          width: `${table.width || 70}px`,
                          height: `${table.height || 140}px`,
                          left: '0',
                          top: '0',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: getTableColor(table.id),
                        }}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div className="font-medium text-gray-700 text-xs">{table.seats} people</div>
                          <div className="text-3xl font-bold text-gray-800">{table.name.replace(/Table /i, '')}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
        </div>
      </main>
      
      {/* Controls Panel - Fixed Position */}
      <div className="fixed right-0 top-0 w-[280px] h-full bg-white border-l z-10 overflow-y-auto">
        <Card className="border-0 rounded-none h-full">
          <CardHeader>
            <CardTitle>Controls</CardTitle>
            <CardDescription>
              Manage your seating arrangement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="tables-locked" className="flex items-center gap-2 cursor-pointer">
                  <span>{tablesLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</span>
                  <span>Lock Tables</span>
                </Label>
                <Switch
                  id="tables-locked"
                  checked={tablesLocked}
                  onCheckedChange={setTablesLocked}
                />
              </div>
              

              
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={addCircleTable}
                  disabled={isLoading}
                >
                  Add Circle Table
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={addRectangleTable}
                  disabled={isLoading}
                >
                  Add Rectangle Table
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={resetCanvasView}
                  disabled={isLoading}
                >
                  Reset View
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      disabled={isLoading}
                    >
                      Clear All Assignments
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Are you sure you want to clear all assignments?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will remove all guests from their assigned seats and return them to the unassigned list.
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button 
                  variant="default" 
                  className="w-full justify-start" 
                  onClick={handleSaveArrangement}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Arrangement
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={forceRefreshArrangement}
                  disabled={isLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh from Cloud
                </Button>
              </div>
              
              {isAutoSaving && (
                <div className="text-xs text-muted-foreground flex items-center">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Auto-saving...
                </div>
              )}
              
              {lastSaved && (
                <div className="text-xs text-muted-foreground">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Table Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
            <DialogDescription>
              Make changes to the table properties.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={editingTable?.name || ''}
                onChange={(e) => {
                  if (editingTable) {
                    setEditingTable({
                      ...editingTable,
                      name: e.target.value
                    });
                  }
                }}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Table Type
              </Label>
              <Select 
                value={editingTable?.type || 'circle'} 
                onValueChange={(value: "circle" | "rectangle") => {
                  if (editingTable) {
                    setEditingTable({
                      ...editingTable,
                      type: value
                    });
                  }
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select table type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="rectangle">Rectangle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="seats" className="text-right">
                Seats: {editingTable?.seats || 0}
              </Label>
              <div className="col-span-3">
                <Slider 
                  id="seats" 
                  min={2} 
                  max={12} 
                  step={1} 
                  value={[editingTable?.seats || 0]} 
                  onValueChange={(value: number[]) => {
                    if (editingTable) {
                      setEditingTable({
                        ...editingTable,
                        seats: value[0]
                      });
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              onClick={() => editingTable && deleteTable(editingTable.id)}
            >
              Delete Table
            </Button>
            <Button onClick={saveTableEdits}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
