'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTimer } from '@/contexts/TimerContext';
import { WCA_EVENTS } from '@/lib/events';
import { ChevronDown } from 'lucide-react';
import { EventIcon as EventIconComponent } from '@/lib/EventIcon';

export default function EventSelector({ compact = false }) {
    const { currentEvent, switchEvent, sessions } = useTimer();
    const [isOpen, setIsOpen] = useState(false);

    const currentEventData = WCA_EVENTS.find(e => e.id === currentEvent) || WCA_EVENTS[0];

    const renderEventIcon = (eventId) => {
        return <EventIconComponent eventId={eventId} size={20} />;
    };

    const handleEventSelect = async (eventId) => {
        setIsOpen(false);
        if (eventId !== currentEvent) {
            await switchEvent(eventId);
        }
    };

    const categoryOrder = ['cube', 'bigcube', 'special'];
    const categoryLabels = {
        cube: 'Cubes',
        bigcube: 'Big Cubes',
        special: 'Special'
    };

    const eventsByCategory = categoryOrder.reduce((acc, cat) => {
        acc[cat] = WCA_EVENTS.filter(e => e.category === cat);
        return acc;
    }, {});

    return (
        <>
            <Button
                variant={compact ? "ghost" : "outline"}
                size={compact ? "sm" : "default"}
                onClick={() => setIsOpen(true)}
                className={compact
                    ? "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border-0 font-medium"
                    : "w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white"
                }
            >
                {renderEventIcon(currentEvent)}
                <span className="font-semibold">{currentEventData.name}</span>
                <ChevronDown className="w-4 h-4 ml-1 opacity-50" />
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 max-w-md w-[90vw]">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-900 dark:text-white">Select Event</DialogTitle>
                        <DialogDescription className="sr-only">
                            Choose a WCA event to practice
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[60vh] pr-4">
                        {categoryOrder.map(category => (
                            <div key={category} className="mb-6">
                                <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                    {categoryLabels[category]}
                                </h3>
                                <div className="space-y-1">
                                    {eventsByCategory[category].map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => handleEventSelect(event.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${event.id === currentEvent
                                                    ? 'bg-blue-600/20 border border-blue-600/50 text-blue-700 dark:text-blue-300'
                                                    : 'bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                                                }`}
                                        >
                                            {renderEventIcon(event.id)}
                                            <span className="font-medium">{event.name}</span>
                                            <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                                                {event.fullName}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
