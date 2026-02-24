"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import SolveList from './SolveList';

export default function SolveDrawer({ isOpen, onClose, solves, onDeleteSolve, onUpdatePenalty, isMobile = false }) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={`
        bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800
        ${isMobile
                    ? 'fixed bottom-0 left-0 right-0 rounded-t-xl max-w-full w-full'
                    : 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl max-w-md w-[90vw] md:w-[500px]'
                }
      `}>
                <DialogHeader>
                    <DialogTitle className="text-zinc-900 dark:text-white text-center">All Solves ({solves?.length || 0})</DialogTitle>
                </DialogHeader>
                <ScrollArea className={isMobile ? 'h-[60vh]' : 'h-[50vh] md:h-[400px]'}>
                    <SolveList solves={solves} onDeleteSolve={onDeleteSolve} onUpdatePenalty={onUpdatePenalty} showFullList={true} />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
