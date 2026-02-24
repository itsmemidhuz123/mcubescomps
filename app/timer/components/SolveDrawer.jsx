"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import SolveList from './SolveList';

export default function SolveDrawer({ isOpen, onClose, solves, onDeleteSolve, onUpdatePenalty }) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-md w-[90vw] md:w-[500px] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl">
                <DialogHeader>
                    <DialogTitle className="text-white text-center">All Solves ({solves?.length || 0})</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[50vh] md:h-[400px]">
                    <SolveList solves={solves} onDeleteSolve={onDeleteSolve} onUpdatePenalty={onUpdatePenalty} />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
