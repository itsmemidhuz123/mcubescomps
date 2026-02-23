'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Cloud, CloudOff, HardDrive, Trash2 } from 'lucide-react';

export default function MergeDialog({
    isOpen,
    onClose,
    onMerge,
    onKeepLocal,
    onDiscard,
    localSessionCount = 0
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-md w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="text-white">Merge Timer Data</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        You have {localSessionCount} session{localSessionCount > 1 ? 's' : ''} stored locally.
                        How would you like to proceed?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 border-[#2a2f3a] hover:bg-[#1e2330]"
                        onClick={() => onMerge()}
                    >
                        <Cloud className="w-5 h-5 mr-3 text-blue-400" />
                        <div className="text-left">
                            <div className="font-medium text-white">Merge</div>
                            <div className="text-xs text-zinc-400">Upload local data to cloud</div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 border-[#2a2f3a] hover:bg-[#1e2330]"
                        onClick={() => onKeepLocal()}
                    >
                        <HardDrive className="w-5 h-5 mr-3 text-green-400" />
                        <div className="text-left">
                            <div className="font-medium text-white">Keep Local</div>
                            <div className="text-xs text-zinc-400">Continue using local data only</div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 border-[#2a2f3a] hover:bg-[#1e2330]"
                        onClick={() => onDiscard()}
                    >
                        <Trash2 className="w-5 h-5 mr-3 text-red-400" />
                        <div className="text-left">
                            <div className="font-medium text-white">Discard Local</div>
                            <div className="text-xs text-zinc-400">Use cloud data only</div>
                        </div>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
