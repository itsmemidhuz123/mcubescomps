'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Timer, Eye, Zap, Trash2, Info, Palette, Cloud } from 'lucide-react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useAuth } from '@/contexts/AuthContext';

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
    return (
        <TimerProvider>
            <TimerSettingsContent />
        </TimerProvider>
    );
}

function TimerSettingsContent() {
    const router = useRouter();
    const { settings, updateSettings, resetCurrentSession, resetAllTimerData, manualSync, syncStatus } = useTimer();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState('display');
    const [showResetSessionDialog, setShowResetSessionDialog] = useState(false);
    const [showResetAllDialog, setShowResetAllDialog] = useState(false);

    const tabs = [
        { id: 'display', label: 'Display', icon: Eye },
        { id: 'behavior', label: 'Timer', icon: Timer },
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'sync', label: 'Sync', icon: Cloud }
    ];

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
            <div className="w-full px-4 py-6">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/timer')} className="text-zinc-400 hover:text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Timer
                    </Button>
                </div>

                <h1 className="text-2xl font-bold text-white mb-6">Timer Settings</h1>

                <div className="flex gap-1 mb-6 bg-zinc-800/50 p-1 rounded-lg">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="space-y-6">
                    {activeTab === 'display' && (
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

                            <SettingRow
                                label="Default Scramble View"
                                description="2D or 3D visualization"
                            >
                                <Select
                                    value={settings.defaultScrambleVisualization || '2d'}
                                    onValueChange={(v) => updateSettings({ defaultScrambleVisualization: v })}
                                >
                                    <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2d">2D</SelectItem>
                                        <SelectItem value="3d">3D</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                        </Section>
                    )}

                    {activeTab === 'behavior' && (
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
                    )}

                    {activeTab === 'theme' && (
                        <Section title="Theme & Appearance" icon={Palette}>
                            <SettingRow
                                label="Timer Font Size"
                                description="Size of the timer display"
                            >
                                <Select
                                    value={settings.timerFontSize || 'medium'}
                                    onValueChange={(v) => updateSettings({ timerFontSize: v })}
                                >
                                    <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="small">Small (2.5rem)</SelectItem>
                                        <SelectItem value="medium">Medium (4rem)</SelectItem>
                                        <SelectItem value="large">Large (6rem)</SelectItem>
                                        <SelectItem value="xlarge">Extra Large (8rem)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>

                            <SettingRow
                                label="Timer Font Style"
                                description="Font family for timer display"
                            >
                                <Select
                                    value={settings.timerFontStyle || 'monospace'}
                                    onValueChange={(v) => updateSettings({ timerFontStyle: v })}
                                >
                                    <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monospace">Monospace</SelectItem>
                                        <SelectItem value="sansSerif">Sans Serif</SelectItem>
                                        <SelectItem value="statement">Statement</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>

                            <SettingRow
                                label="Timer Display Mode"
                                description="How the timer updates during solves"
                            >
                                <Select
                                    value={settings.timerDisplayMode || 'live'}
                                    onValueChange={(v) => updateSettings({ timerDisplayMode: v })}
                                >
                                    <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="live">Live (10ms)</SelectItem>
                                        <SelectItem value="solving">Solving...</SelectItem>
                                        <SelectItem value="secondsOnly">Seconds Only (1s)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>

                            <SettingRow
                                label="Reduce Motion"
                                description="Minimize animations and transitions"
                            >
                                <Switch
                                    checked={settings.reduceMotion || false}
                                    onCheckedChange={(checked) => updateSettings({ reduceMotion: checked })}
                                />
                            </SettingRow>

                            <SettingRow
                                label="Disable Glow Effects"
                                description="Remove glowing shadows and effects"
                            >
                                <Switch
                                    checked={settings.disableGlow || false}
                                    onCheckedChange={(checked) => updateSettings({ disableGlow: checked })}
                                />
                            </SettingRow>

                            <SettingRow
                                label="High Contrast"
                                description="Increase contrast for better visibility"
                            >
                                <Switch
                                    checked={settings.highContrast || false}
                                    onCheckedChange={(checked) => updateSettings({ highContrast: checked })}
                                />
                            </SettingRow>
                        </Section>
                    )}

                    {activeTab === 'sync' && (
                        <Section title="Cloud Sync" icon={Cloud}>
                            {!user ? (
                                <div className="py-4 text-zinc-400 text-sm">
                                    Sign in to enable cloud sync for your timer data.
                                </div>
                            ) : (
                                <>
                                    <SettingRow
                                        label="Enable Cloud Sync"
                                        description="Sync your solves to your account"
                                    >
                                        <Switch
                                            checked={settings.syncEnabled !== false}
                                            onCheckedChange={(checked) => updateSettings({ syncEnabled: checked })}
                                        />
                                    </SettingRow>

                                    {settings.lastSyncedAt && (
                                        <SettingRow
                                            label="Last Synced"
                                            description={new Date(settings.lastSyncedAt).toLocaleString()}
                                        >
                                            <span className="text-zinc-500 text-sm">
                                                {settings.lastSyncedAt}
                                            </span>
                                        </SettingRow>
                                    )}

                                    <SettingRow
                                        label="Sync Now"
                                        description="Manually sync all your timer data"
                                    >
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={manualSync}
                                            disabled={syncStatus === 'syncing'}
                                            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                                        >
                                            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
                                        </Button>
                                    </SettingRow>
                                </>
                            )}
                        </Section>
                    )}

                    {activeTab === 'display' && (
                        <Section title="Advanced" icon={Trash2}>
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
                    )}

                    {activeTab === 'display' && (
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
                    )}
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