'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useCubingScramble } from '@/hooks/useCubingScramble';
import TimerHeader from '@/app/timer/components/TimerHeader';
import ScrambleCard from '@/app/timer/components/ScrambleCard';
import TimerDisplay from '@/app/timer/components/TimerDisplay';
import NewSessionDialog from '@/app/timer/components/NewSessionDialog';
import SessionHistoryModal from '@/app/timer/components/SessionHistoryModal';
import { Card, CardContent } from '@/components/ui/card';
import SolveList from '@/app/timer/components/SolveList';

function TimerPageContent() {
    const { currentEvent, currentSession, sessions, solves, settings, createSession } = useTimer();
    const eventId = currentEvent?.id ?? '333';
    const { scramble, isLoading: scrambleLoading, generateScramble } = useCubingScramble(eventId);

    const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
    const [showSessionHistory, setShowSessionHistory] = useState(false);

    const handleNewSession = async () => {
        if (typeof createSession === 'function') {
            await createSession();
            setShowNewSessionDialog(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1117] text-white">
            <TimerHeader
                syncStatus={settings?.syncStatus ?? 'unsynced'}
                sessionName={typeof currentSession?.name === 'string' ? currentSession.name : 'Current Session'}
                onNewSession={() => setShowNewSessionDialog(true)}
                onViewHistory={() => setShowSessionHistory(true)}
            />
            <main className="container mx-auto px-4 py-6">
                <div className="grid md:grid-cols-2 gap-6 items-start">
                    <ScrambleCard scramble={scramble} eventId={eventId} isLoading={scrambleLoading} onRefresh={generateScramble} />
                    <TimerDisplay onTimerStop={() => { }} onGenerateScramble={generateScramble} />
                </div>
                <section className="mt-6">
                    <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                        <CardContent className="p-4">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Recent Solves</h3>
                            <SolveList solves={solves} />
                        </CardContent>
                    </Card>
                </section>
            </main>

            <NewSessionDialog
                isOpen={showNewSessionDialog}
                onClose={() => setShowNewSessionDialog(false)}
                onConfirm={handleNewSession}
                sessionName={currentSession?.name || 'Current Session'}
            />

            <SessionHistoryModal
                isOpen={showSessionHistory}
                onClose={() => setShowSessionHistory(false)}
                sessions={sessions}
                currentSessionId={currentSession?.sessionId}
            />
        </div>
    );
}

export default function TimerPage() {
    return (
        <TimerProvider>
            <TimerPageContent />
        </TimerProvider>
    );
}