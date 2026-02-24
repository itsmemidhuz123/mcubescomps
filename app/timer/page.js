'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Settings, Clock, FolderOpen, Plus } from 'lucide-react';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function TimerPage() {
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isInspecting, setIsInspecting] = useState(false);
    const [currentSessionName, setCurrentSessionName] = useState('Session 1');
    const [sessions, setSessions] = useState([]);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [solves, setSolves] = useState([]);
    const [isHolding, setIsHolding] = useState(false);
    const [canStart, setCanStart] = useState(false);
    const holdTimerRef = useRef(null);
    const intervalRef = useRef(null);

    const formatTime = (ms) => {
        if (ms < 0) return '0.00';
        const seconds = Math.floor(ms / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
        return `${secs}.${centiseconds.toString().padStart(2, '0')}`;
    };

    const startTimer = useCallback(() => {
        setIsRunning(true);
        setIsInspecting(false);
        const startTime = Date.now();
        intervalRef.current = setInterval(() => {
            setTime(Date.now() - startTime);
        }, 10);
    }, []);

    const stopTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        setIsRunning(false);
        setSolves(prev => [time, ...prev].slice(0, 12));
    }, [time]);

    const startInspection = useCallback(() => {
        setIsInspecting(true);
        setInspectionTime(15);
        intervalRef.current = setInterval(() => {
            setInspectionTime(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    startTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [startTimer]);

    const handleKeyDown = useCallback((e) => {
        if (e.code === 'Space' && !isHolding) {
            e.preventDefault();
            if (isRunning) {
                stopTimer();
            } else if (!isInspecting) {
                setIsHolding(true);
                holdTimerRef.current = setTimeout(() => {
                    setCanStart(true);
                }, 300);
            }
        }
    }, [isRunning, isInspecting, isHolding, stopTimer]);

    const handleKeyUp = useCallback((e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (holdTimerRef.current) {
                clearTimeout(holdTimerRef.current);
            }
            if (canStart && !isRunning) {
                startTimer();
            }
            setIsHolding(false);
            setCanStart(false);
        }
    }, [canStart, isRunning, startTimer]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        };
    }, [handleKeyDown, handleKeyUp]);

    const reset = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTime(0);
        setIsRunning(false);
        setIsInspecting(false);
        setInspectionTime(15);
    };

    const calculateAo5 = () => {
        if (solves.length < 5) return null;
        const last5 = solves.slice(0, 5);
        const sorted = [...last5].sort((a, b) => a - b);
        const middle3 = sorted.slice(1, 4);
        return middle3.reduce((a, b) => a + b, 0) / 3;
    };

    const ao5 = calculateAo5();
    const best = solves.length > 0 ? Math.min(...solves) : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-black">
            {/* Header */}
            <div className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-end h-12 gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-zinc-700 dark:text-zinc-300 gap-1">
                                    <FolderOpen className="w-4 h-4" />
                                    <span>{currentSessionName}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                <div className="px-2 py-1.5 text-xs text-zinc-500 font-medium">
                                    Sessions
                                </div>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-700" />
                                <DropdownMenuItem className="cursor-pointer">
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Session
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link href="/timer/settings">
                            <Button variant="ghost" size="icon" className="text-zinc-600 dark:text-zinc-400">
                                <Settings className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    {/* Timer Display */}
                    <div className="text-center mb-8">
                        <div
                            className={`text-9xl font-mono font-bold mb-4 transition-colors ${isHolding && !canStart ? 'text-red-500' :
                                    canStart ? 'text-green-500' :
                                        isRunning ? 'text-zinc-900 dark:text-white' :
                                            isInspecting ? 'text-yellow-500' : 'text-zinc-900 dark:text-white'
                                }`}
                        >
                            {isInspecting ? inspectionTime : formatTime(time)}
                        </div>

                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            {isRunning ? 'Press SPACE to stop' :
                                isInspecting ? 'Inspection...' :
                                    isHolding ? (canStart ? 'Release to start!' : 'Hold...') :
                                        'Hold SPACE to start'}
                        </p>

                        <div className="flex justify-center gap-4">
                            <Button
                                variant="outline"
                                onClick={reset}
                                className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reset
                            </Button>
                            <Button
                                variant="outline"
                                onClick={startInspection}
                                disabled={isRunning || isInspecting}
                                className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <Clock className="w-4 h-4 mr-2" />
                                Start Inspection
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                            <CardContent className="p-4 text-center">
                                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Best</div>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {best ? formatTime(best) : '-'}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                            <CardContent className="p-4 text-center">
                                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Ao5</div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {ao5 ? formatTime(ao5) : '-'}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                            <CardContent className="p-4 text-center">
                                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Solves</div>
                                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {solves.length}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Solves List */}
                    <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                        <CardContent className="p-4">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Recent Solves</h3>
                            {solves.length === 0 ? (
                                <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No solves yet. Press SPACE to start!</p>
                            ) : (
                                <div className="grid grid-cols-4 gap-2">
                                    {solves.map((solve, index) => (
                                        <div
                                            key={index}
                                            className={`p-3 rounded-lg text-center ${solve === best ? 'bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-700' : 'bg-zinc-100 dark:bg-zinc-700'
                                                }`}
                                        >
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">#{solves.length - index}</div>
                                            <div className={`font-mono font-bold ${solve === best ? 'text-green-600 dark:text-green-400' : 'text-zinc-900 dark:text-white'
                                                }`}>
                                                {formatTime(solve)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default TimerPage;