"use client";

import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';
import { ChevronDown, Layers } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function EventSelector({
  registeredEvents,
  currentEvent,
  onSelect,
  competitionMode,
  currentRound
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!registeredEvents || registeredEvents.length === 0) {
    return null;
  }

  if (registeredEvents.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <EventIcon eventId={registeredEvents[0]} size={20} />
        <span className="font-medium">{getEventName(registeredEvents[0])}</span>
        {competitionMode === 'tournament' && (
          <span className="text-sm text-gray-400">Round {currentRound || 1}</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
      >
        <EventIcon eventId={currentEvent} size={20} />
        <span className="font-medium">{getEventName(currentEvent)}</span>
        {competitionMode === 'tournament' && (
          <span className="text-sm text-gray-400">Round {currentRound || 1}</span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              Select Event
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {registeredEvents.map(eventId => (
              <button
                key={eventId}
                onClick={() => {
                  onSelect(eventId);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                  eventId === currentEvent ? 'bg-blue-600/20 text-blue-400' : 'text-white'
                }`}
              >
                <EventIcon eventId={eventId} size={20} />
                <span className="font-medium">{getEventName(eventId)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
