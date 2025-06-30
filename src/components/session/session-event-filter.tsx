'use client';

import { useState, useEffect } from 'react';
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

interface SessionEventFilterProps {
  value: string | null;
  onChange: (eventName: string | null) => void;
  className?: string;
}

export default function SessionEventFilter({ 
  value,
  onChange, 
  className = "" 
}: SessionEventFilterProps) {
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Events beim ersten Laden abrufen
  useEffect(() => {
    loadEvents();
  }, []);

  // Events von der Session API laden
  async function loadEvents() {
    try {
      setEventsLoading(true);
      
      // Spezielle Route für Session Events
      const response = await fetch('/api/sessions/events');
      const data = await response.json();
      
      if (data.status === 'success') {
        setAvailableEvents(data.data.events || []);
      } else {
        console.error('Fehler beim Laden der Session Events:', data.message);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Session Events:', error);
    } finally {
      setEventsLoading(false);
    }
  }

  // Event-Auswahl behandeln
  const handleEventSelect = (eventName: string) => {
    if (eventName === "alle") {
      onChange(null);
    } else {
      onChange(eventName);
    }
  };

  // Filter zurücksetzen
  const clearFilter = () => {
    onChange(null);
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
        value={value || "alle"} 
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
      {value && (
        <div className="flex items-center gap-1">
          <Badge variant="default" className="flex items-center gap-1">
            <span>{value}</span>
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