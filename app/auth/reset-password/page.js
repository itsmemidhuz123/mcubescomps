'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { resetPassword } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await resetPassword(email);
            setSuccess(true);
        } catch (error) {
            console.error('Password reset error:', error);
            if (error.code === 'auth/user-not-found') {
                setError('No account found with this email address.');
            } else if (error.code === 'auth/invalid-email') {
                setError('Please enter a valid email address.');
            } else if (error.code === 'auth/too-many-requests') {
                setError('Too many requests. Please try again later.');
            } else {
                setError(error.message || 'Failed to send reset email. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950">
            <div className="w-full max-w-md space-y-8">
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <Image
                            src="https://themcubes.in/wp-content/uploads/2025/12/app_icon.jpg"
                            alt="MCUBES"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>

                {!success ? (
                    <>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Reset password</h1>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Enter your email address and we&apos;ll send you a link to reset your password.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    Email
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="h-11 pl-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:border-purple-500 focus:ring-purple-500 dark:text-white"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm"
                            >
                                {loading ? 'Sending...' : 'Send reset link'}
                            </Button>
                        </form>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-center">
                            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                        </div>

                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Check your email</h1>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                We&apos;ve sent a password reset link to <span className="font-medium text-zinc-900 dark:text-white">{email}</span>
                            </p>
                        </div>

                        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 text-sm text-zinc-600 dark:text-zinc-400">
                            <p>Didn&apos;t receive the email? Check your spam folder or</p>
                            <button
                                onClick={() => {
                                    setSuccess(false);
                                    setLoading(false);
                                }}
                                className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                            >
                                try again with a different email
                            </button>
                        </div>
                    </div>
                )}

                <div className="pt-4">
                    <Link
                        href="/auth/login"
                        className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to login
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ResetPasswordPage;