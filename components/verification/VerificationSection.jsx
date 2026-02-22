'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { VerifiedBadge, VerificationStatusBadge } from './VerifiedBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion, Clock, AlertTriangle, Loader2 } from 'lucide-react';

export function VerificationSection({ compact = false }) {
    const { user, userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const verificationStatus = userProfile?.verificationStatus || 'UNVERIFIED';
    const verifiedAt = userProfile?.verifiedAt;
    const attemptCount = userProfile?.verificationAttemptCount || 0;
    const duplicateDetected = userProfile?.duplicateDetected || false;
    const lastResult = userProfile?.lastVerificationResult;

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
                } else {
                    setError(data.error || 'Failed to start verification');
                }
                return;
            }

            if (data.verificationUrl) {
                const DiditSdk = (await import('@didit-protocol/sdk-web')).default;

                DiditSdk.init({
                    session_token: data.sessionToken,
                    onSuccess: (session) => {
                        console.log('Verification completed:', session);
                        window.location.reload();
                    },
                    onError: (error) => {
                        console.error('Verification error:', error);
                        setError('Verification failed. Please try again.');
                        setLoading(false);
                    },
                    onCancel: () => {
                        console.log('Verification cancelled');
                        setLoading(false);
                    }
                });

                DiditSdk.startVerification({ url: data.verificationUrl });
            }
        } catch (err) {
            console.error('Verification error:', err);
            setError('An unexpected error occurred');
        } finally {
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
                            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Verification Pending</h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Your identity verification is being processed. This usually takes a few minutes.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                                onClick={() => window.location.reload()}
                            >
                                Check Status
                            </Button>
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
                                        : 'Your identity verification was not approved. Please try again.'
                                }
                            </p>
                            {attemptCount < 3 && (
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
                            {attemptCount >= 3 && (
                                <p className="text-xs text-red-500 mt-2">
                                    Maximum attempts reached. Please contact support.
                                </p>
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
                        <p className="text-[10px] text-zinc-400 text-center mt-2">
                            {attemptCount > 0 && `Attempt ${attemptCount} of 3`}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
