'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationSection } from './VerificationSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

export function VerificationEnforcement({
    competitionId,
    currentRound = 1,
    verificationMandatory = false,
    verificationRequiredFromRound = 1,
    children
}) {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [verificationStatus, setVerificationStatus] = useState('UNVERIFIED');

    useEffect(() => {
        async function fetchVerificationStatus() {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const authToken = await user.getIdToken();
                const res = await fetch(`/api/verification/status?userId=${user.uid}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    setVerificationStatus(data.verificationStatus || 'UNVERIFIED');
                }
            } catch (err) {
                console.error('Failed to fetch verification status:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchVerificationStatus();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    const requiresVerification = verificationMandatory && currentRound >= verificationRequiredFromRound;
    const isVerified = verificationStatus === 'VERIFIED';

    if (!requiresVerification || isVerified) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardContent className="p-6">
                    <div className="text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                            <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>

                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                            Verification Required
                        </h2>

                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            This competition requires identity verification from round {verificationRequiredFromRound}.
                            Please verify your identity to continue participating.
                        </p>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-4 mb-6">
                            <VerificationSection />
                        </div>

                        <Button
                            onClick={() => router.push('/profile')}
                            className="w-full"
                        >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Go to Profile to Verify
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
