"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
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
  Loader2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { getLatestArrangement, saveArrangement } from '@/lib/db';

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
const generateCircularSeatPositions = (seats: number, tableRadius: number = 50) => {
  const positions = [];
  const seatDistance = tableRadius + 15; // Increased distance for better spacing
  const badgeDistance = tableRadius + 30; // Distance for badges from center
  
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
const generateRectangularSeatPositions = (seats: number, width: number = 80, height: number = 160) => {
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
      badgeOffset: { x: -20, y: 0 } // Badge offset for left side
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
      badgeOffset: { x: 20, y: 0 } // Badge offset for right side
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

// Guest list data
const guestListData = [
  "Julia Lew",
  "Brandon Lew",
  "Miles Schlenker",
  "Will Hart",
  "Spencer Nelson",
  "Elizabeth Nelson",
  "David Ha",
  "Janet Ha",
  "Faith Choi",
  "Dina Chang",
  "Daniel Chae",
  "Sarah Pak",
  "Chris Kim",
  "Charlotte Cheng",
  "Sharon Bahng",
  "Brian Chung",
  "Ethan Cheng",
  "Jae Choi",
  "Daisy Velarde",
  "Alex Wada",
  "Danika Banh",
  "Dillion Banh",
  "Ashley Lee",
  "Candice Matsumara",
  "Songi Park",
  "Antonio Park",
  "Peter Park",
  "Rellia Jung",
  "Junyong Lee",
  "Rubin Lee",
  "Ruan Lee",
  "Ruhyuk Lee",
  "Youja Kim",
  "Hyoungun Kang",
  "Juyong Kang",
  "Susie Shin",
  "Sam Shin",
  "Hera Lee",
  "Howard Kwon",
  "Semi Kim",
  "James Oh",
  "Royce Oh",
  "Dave An",
  "Colleen Song",
  "Logan Park",
  "Eugenia Park",
  "Andrew Wong",
  "Lydia Ko",
  "Christian Castillo",
  "Angeles Castillo",
  "Darryl Bobbie",
  "Anna Kuo",
  "Austin Benzinger",
  "Bri Benzinger",
  "Hans Hinebaugh",
  "Casey Harrison",
  "Mishan Rambukwella",
  "James Soehardjono",
  "Steven Hunt",
  "Brent Yerkes",
  "Nathan Yanaga",
  "Nozomi Yanaga",
  "Audrey Kwok",
  "Jacklyn Kwok",
  "Christopher Kwok",
  "Jessica Moore",
  "Ryan Moore",
  "Stephanie Fong",
  "Julie Strickland",
  "Amy Wang",
  "Erica Wu",
  "Albert Wan",
  "Allison Wan",
  "Archana Bettadapur",
  "Hailey Pink",
  "Maria Schriber",
  "Jen Rodriguez",
  "Julia Aguirre",
  "Kimberly Soy Tamkin",
  "John Tamkin",
  "Liz Walls",
  "Joycelyn Yip",
  "Anand Ganapathy",
  "Yuta Ando",
  "Patrick Chi",
  "Sungeun Chi",
  "Grace Min",
  "Raymond Kwon",
  "Pauline Park",
  "Alex Chi",
  "Stuart Mar",
  "William Yu",
  "Esther Kim",
  "Miya Joo",
  "Patrick Hua",
  "Katie Kim",
  "Jacqueline Kim",
  "Jessica Cha",
  "Justice Epps",
  "Matthew Epps",
  "Marc Jimenez",
  "Camille Tse",
  "Keyon Vafa",
  "Katherine Chen",
  "Elena Schneider",
  "Tracy Fong",
  "Francis Miranda",
  "Teddy Fong",
  "Tiffany Fong",
  "Daina Cheng",
  "Edmond Cheng",
  "Patricia Wong Kim",
  "Austin Kim",
  "Tiffany Cheng Zappia",
  "Eduardo Zappia",
  "Maryann Fong",
  "Daniel Fong",
  "Kevin Wong",
  "Nancy Wong",
  "Frank Geraci",
  "Joanne Geraci",
  "Richard Chernick",
  "Karla Chernick",
  "Candace Cooper",
  "Erin Becks",
  "Julia Yip",
  "Andrew Yip",
  "Daiyee Hui",
  "George Hui",
  "May Fong",
  "Dan Banh",
  "Ellen Banh",
  "Yeoman Chan",
  "Cherry Chan",
  "Jet Long",
  "Daisy Kwok",
  "John Kwok",
  "Grandma Kwok",
  "Li Qin",
  "Shiliang Qin",
  "Desai Wu",
  "Ernie Chen",
  "Kay Chen",
  "Annie Chen",
  "Garbo Au Yeung",
  "Alan Au Yeung",
  "Susan Leung",
  "Vanessa Esparza",
  "Paul Esparza",
  "Vanessa Miranda",
  "Pearl Pon",
  "Rob Pon",
  "Margaret Chow",
  "Gracie Chow",
  "Rosalie Cho",
  "Evan Chen",
  "Elly Chen",
  "Aria Qin",
  "Miles Qin",
  "Elias Chen",
  "Elijah Moore",
  "Cameron Fong",
  "Lolo Fong",
  "Sophie Fong",
  "Jiong Cheng"
];

export default function Home() {
  const [tables, setTables] = useState<Table[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTable, setCurrentTable] = useState<string | null>(null);
  const [highlightedSeatId, setHighlightedSeatId] = useState<string | null>(null);
  const [tablesLocked, setTablesLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Initialize guest list from data or load from Supabase
  useEffect(() => {
    // Load the arrangement from Supabase
    const loadArrangement = async () => {
      setIsLoading(true);
      const arrangement = await getLatestArrangement();
      
      if (arrangement) {
        // Cast through unknown to satisfy TypeScript
        setTables(arrangement.data.tables as unknown as Table[]);
        setSeats(arrangement.data.seats as unknown as Seat[]);
        setGuests(arrangement.data.guests as unknown as Guest[]);
        setLastSaved(new Date(arrangement.updated_at));
        toast.success("Arrangement loaded", {
          description: "The seating arrangement has been loaded."
        });
      } else {
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
          } catch (error) {
            console.error("Error loading saved data:", error);
            initializeGuestList();
          }
        } else {
          initializeGuestList();
        }
      }
      setIsLoading(false);
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
  const handleAutoSave = async () => {
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
  };

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

  // Add a new circular table
  const addCircleTable = () => {
    const newTableId = `table-${Date.now()}`;
    const newTable: Table = {
      id: newTableId,
      x: 100,
      y: 100,
      name: `Table ${tables.length + 1}`,
      seats: 12,
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
      seats: 12,
      type: "rectangle",
      width: 80,
      height: 160
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
    setIsDragging(true);
    setCurrentTable(tableId);
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !currentTable || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    
    setTables(tables.map(table => 
      table.id === currentTable 
        ? { ...table, x, y } 
        : table
    ));
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setCurrentTable(null);
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
    toast.info("Table deleted", {
      description: `Table and ${tableSeats.length} seats have been removed`
    });
  };

  // Handle guest drag start
  const handleGuestDragStart = (e: React.DragEvent, guestId: string) => {
    e.dataTransfer.setData('text/plain', guestId);
  };

  // Handle guest drag end
  const handleGuestDragEnd = () => {
  };

  // Handle seat drag over
  const handleSeatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
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
    
    const guestId = e.dataTransfer.getData('text/plain');
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
            toast.success(`Guests swapped`, {
              description: `${movingGuest.name} and ${displacedGuest.name} have swapped seats`
            });
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
          toast.success(`${guest.name} moved`, {
            description: "Guest has been moved to a new seat"
          });
        } else {
          toast.success(`${guest.name} seated`, {
            description: "Guest has been assigned to a seat"
          });
        }
      }
    }
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
    if (searchQuery.trim() === '') {
      return unassignedGuestsList;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return unassignedGuestsList.filter(guest => 
      guest.name.toLowerCase().includes(query)
    );
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
    toast.info("All guests unassigned", {
      description: "All guests have been returned to the unassigned list"
    });
  };

  // Add event listeners for mouse up outside the canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setCurrentTable(null);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);

  // Get first name of a guest
  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0];
  };

  return (
    <div className="min-h-screen p-4 flex">
      {/* Guest List Sidebar */}
      <div className="w-64 mr-4 flex flex-col">
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle>Guest List</CardTitle>
            <CardDescription>
              {filteredUnassignedGuests.length} unassigned guests
            </CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search guests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
                {filteredUnassignedGuests.length > 0 ? (
                  filteredUnassignedGuests.map(guest => (
                    <div
                      key={guest.id}
                      className="p-2 bg-white border rounded-md cursor-move hover:bg-gray-50"
                      draggable
                      onDragStart={(e) => handleGuestDragStart(e, guest.id)}
                      onDragEnd={handleGuestDragEnd}
                    >
                      {guest.name}
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-gray-500 text-center">
                    {searchQuery ? 'No matching guests found' : 'All guests are seated'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <main className="flex-1 space-y-6 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle>Christina + Brian Wedding</CardTitle>
            <CardDescription>Drag and drop tables and guests to seats.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex justify-between mb-4">
              <div className="flex gap-2">
                <Button onClick={addCircleTable}>Add Circle Table</Button>
                <Button onClick={addRectangleTable}>Add Rectangle Table</Button>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex items-center space-x-2 mr-2">
                  <Switch 
                    id="lock-tables" 
                    checked={tablesLocked}
                    onCheckedChange={setTablesLocked}
                  />
                  <Label htmlFor="lock-tables" className="flex items-center cursor-pointer">
                    {tablesLocked ? 
                      <Lock className="h-4 w-4 mr-1" /> : 
                      <Unlock className="h-4 w-4 mr-1" />
                    }
                    {tablesLocked ? "Tables Locked" : "Tables Unlocked"}
                  </Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={handleSaveArrangement} disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Save your seating arrangement</p>
                      {lastSaved && (
                        <p className="text-xs text-gray-500">Last saved: {lastSaved.toLocaleTimeString()}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {isAutoSaving && (
                  <div className="flex items-center text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </div>
                )}
                <Button variant="outline" onClick={handleClearAll}>Clear Guests</Button>
              </div>
            </div>
            
            {/* Canvas for dragging tables */}
            <div 
              ref={canvasRef}
              className="relative flex-1 border border-gray-200 rounded-lg bg-gray-50"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {tables.map((table) => {
                // Generate seat positions based on table type
                const seatPositions = table.type === "circle" 
                  ? generateCircularSeatPositions(table.seats)
                  : generateRectangularSeatPositions(
                      table.seats, 
                      table.width || 80, 
                      table.height || 160
                    );
                
                return (
                  <div
                    key={table.id}
                    className="absolute cursor-move"
                    style={{
                      left: `${table.x}px`,
                      top: `${table.y}px`,
                      transform: 'translate(-50%, -50%)',
                      touchAction: 'none',
                    }}
                    onMouseDown={(e) => handleMouseDown(e, table.id)}
                    onDoubleClick={() => openEditDialog(table)}
                  >
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
                                      className="text-sm px-3 py-1 font-medium cursor-move" 
                                      style={{
                                        backgroundColor: '#fbcfe8',
                                        color: 'rgba(0, 0, 0, 0.8)',
                                        border: '1px solid rgba(0, 0, 0, 0.1)',
                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                        minWidth: '60px',
                                        textAlign: 'center',
                                        display: 'inline-block',
                                        fontSize: '12px',
                                        padding: '2px 6px'
                                      }}
                                    >
                                      {getFirstName(guest.name)}
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
                                width: '24px',
                                height: '24px',
                                transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
                                borderTopLeftRadius: '0px',
                                borderTopRightRadius: '0px',
                                borderBottomLeftRadius: '12px',
                                borderBottomRightRadius: '12px',
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
                        className="absolute bg-white border-2 border-gray-400 rounded-full flex items-center justify-center shadow-md"
                        style={{
                          width: '100px',
                          height: '100px',
                          left: '0',
                          top: '0',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 10,
                          backgroundColor: getTableColor(table.id),
                          borderColor: '#333333',
                        }}
                      >
                        <div className="text-center">
                          <div className="font-medium text-gray-700">{table.name}</div>
                          <div className="text-4xl font-bold text-gray-800">{table.seats}</div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="absolute bg-white border-2 border-gray-400 flex items-center justify-center shadow-md"
                        style={{
                          width: `${table.width || 80}px`,
                          height: `${table.height || 160}px`,
                          left: '0',
                          top: '0',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 10,
                          backgroundColor: getTableColor(table.id),
                          borderColor: '#333333',
                        }}
                      >
                        <div className="text-center">
                          <div className="font-medium text-gray-700">{table.name}</div>
                          <div className="text-4xl font-bold text-gray-800">{table.seats}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

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

      <div className="sonner-toast-container"></div>
    </div>
  );
}
