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

export default function EventSelector({ compact = false }) {
    const { currentEvent, switchEvent, sessions } = useTimer();
    const [isOpen, setIsOpen] = useState(false);

    const currentEventData = WCA_EVENTS.find(e => e.id === currentEvent) || WCA_EVENTS[0];

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
                    ? "bg-transparent hover:bg-zinc-800 text-white border-0"
                    : "w-full bg-[#161a23] border-[#2a2f3a] hover:bg-[#1e2330] hover:border-[#3a3f4a] text-white py-6"
                }
            >
                <span className={compact ? "text-lg" : "text-2xl"}>{currentEventData.icon}</span>
                <span className={compact ? "text-sm font-medium ml-1" : "text-lg font-medium ml-3"}>{currentEventData.name}</span>
                {!compact && (
                    <span className="ml-auto text-xs text-zinc-400">
                        {sessions.length > 0 ? `${sessions.length} session${sessions.length > 1 ? 's' : ''}` : 'Tap to change'}
                    </span>
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-md w-[90vw]">
                    <DialogHeader>
                        <DialogTitle className="text-white">Select Event</DialogTitle>
                        <DialogDescription className="sr-only">
                            Choose a WCA event to practice
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[60vh] pr-4">
                        {categoryOrder.map(category => (
                            <div key={category} className="mb-6">
                                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                                    {categoryLabels[category]}
                                </h3>
                                <div className="space-y-1">
                                    {eventsByCategory[category].map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => handleEventSelect(event.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${event.id === currentEvent
                                                    ? 'bg-blue-600/20 border border-blue-600/50 text-white'
                                                    : 'bg-[#161a23] border border-[#2a2f3a] hover:bg-[#1e2330] text-zinc-300 hover:text-white'
                                                }`}
                                        >
                                            <span className="text-xl">{event.icon}</span>
                                            <span className="font-medium">{event.name}</span>
                                            <span className="ml-auto text-xs text-zinc-500">
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
