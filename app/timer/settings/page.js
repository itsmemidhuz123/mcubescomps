'use client';

import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';

export default function TimerSettingsPage() {
    return (
        <div className="min-h-screen bg-[#0f1117]">
            <div className="container mx-auto px-4 py-8 max-w-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" onClick={() => window.history.back()}>
                        ← Back
                    </Button>
                    <h1 className="text-2xl font-bold text-white">Timer Settings</h1>
                </div>

                <div className="bg-[#161a23] border border-[#2a2f3a] rounded-xl p-8 text-center">
                    <SettingsIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
                    <p className="text-zinc-400 mb-6">
                        Timer settings are under development. Stay tuned for:
                    </p>
                    <ul className="text-left text-zinc-500 space-y-2 max-w-xs mx-auto">
                        <li>• Inspection time toggle</li>
                        <li>• Sound effects</li>
                        <li>• Theme customization</li>
                        <li>• Decimal precision</li>
                        <li>• WCA penalty rules</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}