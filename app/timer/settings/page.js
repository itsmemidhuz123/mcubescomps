'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Timer, Eye, Zap, Trash2, Info } from 'lucide-react';
import { useTimer } from '@/contexts/TimerContext';

function SettingRow({ label, description, children }) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-zinc-800/50 last:border-0">
            <div className="flex-1 pr-4">
                <Label className="text-white font-medium">{label}</Label>
                {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
            </div>
            <div>{children}</div>
        </div>
    );
}

function Section({ title, icon: Icon, children }) {
    return (
        <div className="bg-[#161a23] border border-[#2a2f3a] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center gap-3">
                <Icon className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold text-white">{title}</h2>
            </div>
            <div className="px-5">{children}</div>
        </div>
    );
}

export default function TimerSettingsPage() {
    const router = useRouter();
    const { settings, updateSettings, resetCurrentSession, resetAllTimerData } = useTimer();

    const [showResetSessionDialog, setShowResetSessionDialog] = useState(false);
    const [showResetAllDialog, setShowResetAllDialog] = useState(false);

    const handleResetSession = async () => {
        await resetCurrentSession();
        setShowResetSessionDialog(false);
        router.push('/timer');
    };

    const handleResetAll = async () => {
        await resetAllTimerData();
        setShowResetAllDialog(false);
        router.push('/timer');
    };

    return (
        <div className="min-h-screen bg-[#0f1117]">
            <div className="container mx-auto px-4 py-6 max-w-2xl">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/timer')} className="text-zinc-400 hover:text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Timer
                    </Button>
                </div>

                <h1 className="text-2xl font-bold text-white mb-6">Timer Settings</h1>

                <div className="space-y-6">
                    <Section title="Display Settings" icon={Eye}>
                        <SettingRow
                            label="Timer Decimal Points"
                            description="Number of decimal places shown"
                        >
                            <Select
                                value={settings.decimalPoints.toString()}
                                onValueChange={(v) => updateSettings({ decimalPoints: parseInt(v) })}
                            >
                                <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>

                        <SettingRow
                            label="Show Scramble Image"
                            description="Display floating cube in bottom-right corner"
                        >
                            <Switch
                                checked={settings.showScrambleImage}
                                onCheckedChange={(checked) => updateSettings({ showScrambleImage: checked })}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Show Large Averages"
                            description="Display Ao50, Ao100, Ao500, Ao1000"
                        >
                            <Switch
                                checked={settings.showLargeAverages}
                                onCheckedChange={(checked) => updateSettings({ showLargeAverages: checked })}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Show Session Stats Panel"
                            description="Display statistics panel on timer page"
                        >
                            <Switch
                                checked={settings.showSessionStatsPanel}
                                onCheckedChange={(checked) => updateSettings({ showSessionStatsPanel: checked })}
                            />
                        </SettingRow>
                    </Section>

                    <Section title="Timer Behavior" icon={Timer}>
                        <SettingRow
                            label="Inspection Mode"
                            description="Enable WCA 15-second inspection rules"
                        >
                            <Switch
                                checked={settings.inspectionEnabled}
                                onCheckedChange={(checked) => updateSettings({ inspectionEnabled: checked })}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Freeze Time"
                            description={`${settings.freezeTime.toFixed(1)}s hold required to start`}
                        >
                            <div className="w-40">
                                <Slider
                                    value={[settings.freezeTime]}
                                    onValueChange={([value]) => updateSettings({ freezeTime: value })}
                                    min={0.1}
                                    max={1}
                                    step={0.1}
                                    className="cursor-pointer"
                                />
                            </div>
                        </SettingRow>

                        <SettingRow
                            label="Auto Confirm Solve"
                            description="Save solve instantly without confirmation"
                        >
                            <Switch
                                checked={settings.autoConfirmSolve}
                                onCheckedChange={(checked) => updateSettings({ autoConfirmSolve: checked })}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Enable Sounds"
                            description="Play audio for inspection and timer events"
                        >
                            <Switch
                                checked={settings.enableSounds}
                                onCheckedChange={(checked) => updateSettings({ enableSounds: checked })}
                            />
                        </SettingRow>
                    </Section>

                    <Section title="Visual & Experience" icon={Zap}>
                        <SettingRow
                            label="Enable PB Animation"
                            description="Show glow effect on new personal best"
                        >
                            <Switch
                                checked={settings.enablePBAnimation}
                                onCheckedChange={(checked) => updateSettings({ enablePBAnimation: checked })}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Focus Mode Default"
                            description="Open timer in minimal focus mode"
                        >
                            <Switch
                                checked={settings.focusModeDefault}
                                onCheckedChange={(checked) => updateSettings({ focusModeDefault: checked })}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Fullscreen on Timer Start"
                            description="Automatically enter fullscreen when timer starts"
                        >
                            <Switch
                                checked={settings.fullscreenOnStart}
                                onCheckedChange={(checked) => updateSettings({ fullscreenOnStart: checked })}
                            />
                        </SettingRow>
                    </Section>

                    <Section title="Advanced" icon={Trash2}>
                        <SettingRow
                            label="Reset Current Session"
                            description="Clear all solves in current session"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowResetSessionDialog(true)}
                                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                            >
                                Reset
                            </Button>
                        </SettingRow>

                        <SettingRow
                            label="Reset All Timer Data"
                            description="Clear all sessions, settings, and local data"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowResetAllDialog(true)}
                                className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                            >
                                Reset All
                            </Button>
                        </SettingRow>
                    </Section>
                </div>

                <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-zinc-400">
                        <p className="text-blue-300 font-medium mb-1">Settings apply instantly</p>
                        <p>All changes are saved automatically and persist across sessions.</p>
                    </div>
                </div>
            </div>

            <AlertDialog open={showResetSessionDialog} onOpenChange={setShowResetSessionDialog}>
                <AlertDialogContent className="bg-[#161a23] border-zinc-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Reset Current Session?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            This will clear all solves in the current session. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-800 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetSession} className="bg-orange-600 hover:bg-orange-700">
                            Reset Session
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showResetAllDialog} onOpenChange={setShowResetAllDialog}>
                <AlertDialogContent className="bg-[#161a23] border-zinc-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Reset All Timer Data?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            This will delete all sessions, solves, and settings. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-800 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetAll} className="bg-red-600 hover:bg-red-700">
                            Reset Everything
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}