import { atom } from 'jotai';

// Atom für den gewählten Event-Filter
export const selectedEventAtom = atom<string | null>(null);

// Atom für alle verfügbaren Events
export const availableEventsAtom = atom<string[]>([]);

// Kombiniertes Atom für Event-Filter-Status
export const eventFilterStateAtom = atom(
  (get) => ({
    selectedEvent: get(selectedEventAtom),
    availableEvents: get(availableEventsAtom),
    isFiltered: get(selectedEventAtom) !== null
  })
);

// Atom für Loading-Status der Events
export const eventsLoadingAtom = atom<boolean>(false); 