'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Maximize2, Minimize2, Eye, EyeOff, Plus, History, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useTimer } from '@/contexts/TimerContext';
import { WCA_EVENTS } from '@/lib/events';

export default function TimerWidget({
    syncStatus = 'not_synced',
    onSync,
    isFullscreen = false,
    onToggleFullscreen,
    isFocusMode = false,
    onToggleFocusMode,
    sessionName = 'Session 1',
    onNewSession,
    onViewHistory,
}) {
    const { currentEvent, switchEvent } = useTimer();
    const [showEventSelector, setShowEventSelector] = useState(false);

    const currentEventData = WCA_EVENTS.find(e => e.id === currentEvent) || WCA_EVENTS[0];

    const handleEventSelect = async (eventId) => {
        setShowEventSelector(false);
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
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-40 transition-opacity duration-300 ${isFullscreen || isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
            <div className="flex items-center gap-2 bg-[#161a23] border border-[#2a2f3a] rounded-xl px-3 py-2 shadow-lg">
                {/* Event Selector */}
                <DropdownMenu open={showEventSelector} onOpenChange={setShowEventSelector}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="text-white hover:bg-[#2a2f3a] px-2">
                            <span className="text-lg mr-1">{currentEventData.icon}</span>
                            <span className="text-sm font-medium">{currentEventData.name}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#161a23] border-[#2a2f3a] max-h-80 overflow-y-auto">
                        {categoryOrder.map(category => (
                            <div key={category}>
                                <div className="px-2 py-1 text-xs text-zinc-500 uppercase">
                                    {categoryLabels[category]}
                                </div>
                                {eventsByCategory[category].map(event => (
                                    <DropdownMenuItem
                                        key={event.id}
                                        onClick={() => handleEventSelect(event.id)}
                                        className={`flex items-center gap-2 cursor-pointer ${event.id === currentEvent ? 'bg-blue-600/20 text-blue-400' : 'text-white'
                                            }`}
                                    >
                                        <span>{event.icon}</span>
                                        <span>{event.name}</span>
                                    </DropdownMenuItem>
                                ))}
                            </div>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-6 bg-[#2a2f3a]" />

                {/* Session Info */}
                <Button
                    variant="ghost"
                    onClick={onNewSession}
                    className="text-zinc-400 hover:text-white text-xs gap-1 h-8"
                >
                    <Plus className="w-3 h-3" />
                    <span className="hidden sm:inline">New</span>
                </Button>

                <Button
                    variant="ghost"
                    onClick={onViewHistory}
                    className="text-zinc-400 hover:text-white text-xs h-8 px-2"
                    title="Session History"
                >
                    <History className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-[#2a2f3a]" />

                {/* Sync Status */}
                {syncStatus === 'synced' && (
                    <Cloud className="w-4 h-4 text-green-500" />
                )}
                {syncStatus === 'not_synced' && (
                    <CloudOff className="w-4 h-4 text-orange-500" />
                )}

                <div className="w-px h-6 bg-[#2a2f3a]" />

                {/* Fullscreen Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleFullscreen}
                    className="h-8 w-8 text-zinc-400 hover:text-white"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>

                {/* Focus Mode Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleFocusMode}
                    className="h-8 w-8 text-zinc-400 hover:text-white"
                    title={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}
                >
                    {isFocusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
            </div>
        </div>
    );
}
