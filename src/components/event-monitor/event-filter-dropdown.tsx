'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Filter, Loader2 } from 'lucide-react';
import { 
  selectedEventAtom, 
  availableEventsAtom, 
  eventsLoadingAtom 
} from '@/atoms/event-filter-atom';

interface EventFilterDropdownProps {
  onEventChange?: (eventName: string | null) => void;
  className?: string;
}

export default function EventFilterDropdown({ 
  onEventChange, 
  className = "" 
}: EventFilterDropdownProps) {
  const [selectedEvent, setSelectedEvent] = useAtom(selectedEventAtom);
  const [availableEvents, setAvailableEvents] = useAtom(availableEventsAtom);
  const [eventsLoading, setEventsLoading] = useAtom(eventsLoadingAtom);

  // Events beim ersten Laden abrufen
  useEffect(() => {
    loadEvents();
  }, []);

  // Event-Änderung wird automatisch über das Jotai-Atom verfolgt
  // Kein separater useEffect für onEventChange nötig

  // Events von der API laden
  async function loadEvents() {
    try {
      setEventsLoading(true);
      
      const response = await fetch('/api/event-job/events');
      const data = await response.json();
      
      if (data.status === 'success') {
        setAvailableEvents(data.data.events || []);
      } else {
        console.error('Fehler beim Laden der Events:', data.message);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Events:', error);
    } finally {
      setEventsLoading(false);
    }
  }

  // Event-Auswahl behandeln
  const handleEventSelect = (eventName: string) => {
    if (eventName === "alle") {
      setSelectedEvent(null);
    } else {
      setSelectedEvent(eventName);
    }
  };

  // Filter zurücksetzen
  const clearFilter = () => {
    setSelectedEvent(null);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Event:
        </span>
      </div>
      
      <Select 
        value={selectedEvent || "alle"} 
        onValueChange={handleEventSelect}
        disabled={eventsLoading}
      >
        <SelectTrigger className="w-[200px]">
          {eventsLoading ? (
            <div className="flex items-center">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span>Lädt...</span>
            </div>
          ) : (
            <SelectValue placeholder="Event auswählen" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="alle">
            <div className="flex items-center">
              <span>Alle Events</span>
              <Badge variant="outline" className="ml-2 text-xs">
                {availableEvents.length}
              </Badge>
            </div>
          </SelectItem>
          {availableEvents.map((event) => (
            <SelectItem key={event} value={event}>
              {event}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filter-Badge und Clear-Button */}
      {selectedEvent && (
        <div className="flex items-center gap-1">
          <Badge variant="default" className="flex items-center gap-1">
            <span>{selectedEvent}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-white/20"
              onClick={clearFilter}
            >
              <X className="w-3 h-3" />
            </Button>
          </Badge>
        </div>
      )}
    </div>
  );
} 