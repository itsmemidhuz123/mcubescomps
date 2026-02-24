"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import SolveList from './SolveList';
import { useState } from 'react';

export default function SolveDrawer({ isOpen, onClose, solves, onDeleteSolve, onUpdatePenalty }) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-full w-[100%] fixed bottom-0 left-0 right-0 rounded-t-xl">
                <DialogHeader>
                    <DialogTitle className="text-white">All Solves</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] p-2">
                    <SolveList solves={solves} onDeleteSolve={onDeleteSolve} onUpdatePenalty={onUpdatePenalty} />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
