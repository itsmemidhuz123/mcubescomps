'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

export default function NewSessionDialog({
    isOpen,
    onClose,
    onConfirm,
    onCancel,
    sessionName = 'Current Session'
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        Start New Session?
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Your current session "{sessionName}" will be archived. You can view it in session history later.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="border-[#2a2f3a] text-zinc-300 hover:bg-[#161a23]"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        onClick={onConfirm}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Start New Session
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
