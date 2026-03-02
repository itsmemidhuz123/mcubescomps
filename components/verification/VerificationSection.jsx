'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { VerifiedBadge, VerificationStatusBadge } from './VerifiedBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion, Clock, AlertTriangle, Loader2 } from 'lucide-react';

export function VerificationSection({ compact = false }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [verificationData, setVerificationData] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        async function fetchVerificationStatus() {
            if (!user) return;

            try {
                const authToken = await user.getIdToken();
                const res = await fetch(`/api/verification/status?userId=${user.uid}&_=${Date.now()}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    setVerificationData(data);
                }
            } catch (err) {
                console.error('Failed to fetch verification status:', err);
            }
        }

        fetchVerificationStatus();
    }, [user, refreshKey]);

    const verificationStatus = verificationData?.verificationStatus || 'UNVERIFIED';
    const verifiedAt = verificationData?.verifiedAt || null;
    const attemptCount = verificationData?.verificationAttemptCount || 0;
    const duplicateDetected = verificationData?.duplicateDetected || false;
    const lastVerificationAttemptAt = verificationData?.lastVerificationAttemptAt || null;
    const lastResult = verificationData?.lastVerificationResult || null;

    const getRetryInfo = () => {
        if (!lastVerificationAttemptAt) return { canRetry: true, message: null, hoursRemaining: 0 };

        const lastAttempt = new Date(lastVerificationAttemptAt);
        const hoursSinceLastAttempt = (new Date() - lastAttempt) / (1000 * 60 * 60);
        const hoursRemaining = 24 - hoursSinceLastAttempt;

        if (hoursSinceLastAttempt >= 24) {
            return { canRetry: true, message: null, hoursRemaining: 0 };
        }

        return {
            canRetry: false,
            message: `You can retry after ${Math.ceil(hoursRemaining)} hours`,
            hoursRemaining: Math.ceil(hoursRemaining)
        };
    };

    const retryInfo = getRetryInfo();

    const handleStartVerification = async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            const authToken = await user.getIdToken();

            const res = await fetch('/api/verification/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ userId: user.uid })
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429) {
                    setError(data.error || 'Too many attempts. Please try again later.');
                } else if (res.status === 403) {
                    setError(data.error || 'Verification blocked. Please contact support.');
                } else {
                    setError(data.error || 'Failed to start verification');
                }
                setLoading(false);
                return;
            }

            const statusRes = await fetch(`/api/verification/status?userId=${user.uid}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                setVerificationData(statusData);
            }

            if (data.verificationUrl) {
                const initDidit = () => {
                    if (window.DiditSdk && window.DiditSdk.shared) {
                        window.DiditSdk.shared.onComplete = (result) => {
                            if (result?.type === 'completed') {
                                setRefreshKey(prev => prev + 1);
                            }
                        };
                        window.DiditSdk.shared.startVerification({
                            url: data.verificationUrl
                        });
                        setLoading(false);
                        return true;
                    }
                    return false;
                };

                if (!initDidit()) {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@didit-protocol/sdk-web/dist/didit-sdk.umd.min.js';
                    script.onload = () => {
                        if (!initDidit()) {
                            window.location.href = data.verificationUrl;
                        }
                    };
                    script.onerror = () => {
                        window.location.href = data.verificationUrl;
                    };
                    document.head.appendChild(script);
                }
            } else {
                setError('No verification URL received');
                setLoading(false);
            }
        } catch (err) {
            console.error('Verification error:', err);
            setError('An unexpected error occurred');
            setLoading(false);
        }
    };

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <VerificationStatusBadge status={verificationStatus} size="sm" />
                {verificationStatus === 'VERIFIED' && (
                    <VerifiedBadge size="sm" showLabel={false} />
                )}
            </div>
        );
    }

    if (verificationStatus === 'VERIFIED') {
        return (
            <Card className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-green-900 dark:text-green-100">Identity Verified</h3>
                                <VerifiedBadge size="sm" />
                            </div>
                            <p className="text-sm text-green-700 dark:text-green-300">
                                Your identity has been verified. You can participate in verified-only competitions.
                            </p>
                            {verifiedAt && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                    Verified on {new Date(verifiedAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (verificationStatus === 'PENDING') {
        return (
            <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Verification In Progress</h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                                Your identity verification is being processed. This usually takes a few minutes.
                            </p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                Please wait while we verify your identity. The page will update automatically once verification is complete.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (verificationStatus === 'BLOCKED') {
        return (
            <Card className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Verification Blocked</h3>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                                Maximum verification attempts (3) have been reached. Your account has been blocked from further verification attempts.
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400">
                                Please contact support to unlock your verification.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (verificationStatus === 'REJECTED') {
        const rejectedClass = duplicateDetected
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800';

        return (
            <Card className={rejectedClass}>
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${duplicateDetected ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                            {duplicateDetected ? (
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            ) : (
                                <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                                {duplicateDetected ? 'Verification Rejected - Duplicate Detected' : 'Verification Failed'}
                            </h3>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {duplicateDetected
                                    ? 'Your identity could not be verified because the same identity has already been used by another account. This may indicate fraudulent activity.'
                                    : lastResult?.reason
                                        ? `Reason: ${lastResult.reason}`
                                        : 'Your identity verification was not approved.'
                                }
                            </p>
                            {attemptCount >= 3 ? (
                                <p className="text-xs text-red-500 mt-2">
                                    Maximum attempts (3) reached.
                                </p>
                            ) : retryInfo.canRetry ? (
                                <p className="text-xs text-green-600 mt-2">
                                    You can try again now. ({attemptCount}/3 attempts used)
                                </p>
                            ) : (
                                <p className="text-xs text-red-500 mt-2">
                                    {retryInfo.message}
                                </p>
                            )}
                            {retryInfo.canRetry && attemptCount < 3 && (
                                <Button
                                    className="mt-3 bg-red-600 hover:bg-red-700"
                                    onClick={handleStartVerification}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Starting...
                                        </>
                                    ) : (
                                        'Try Again'
                                    )}
                                </Button>
                            )}
                            {(!retryInfo.canRetry || attemptCount >= 3) && (
                                <Button
                                    className="mt-3"
                                    disabled={true}
                                >
                                    {attemptCount >= 3 ? 'Maximum attempts reached' : retryInfo.message}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-700">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <ShieldQuestion className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Verify Your Identity</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                            Complete identity verification to participate in cash prize tournaments and compete with verified competitors.
                        </p>
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                                <span>Access to cash prize competitions</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                                <span>Verified competitor badge</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                                <span>Trust and credibility with other players</span>
                            </div>
                        </div>
                        {error && (
                            <div className="text-xs text-red-500 mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                {error}
                            </div>
                        )}
                        <Button
                            onClick={handleStartVerification}
                            disabled={loading}
                            className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Starting Verification...
                                </>
                            ) : (
                                <>
                                    <Shield className="w-4 h-4 mr-2" />
                                    Verify Identity
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
