'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn(email, password, rememberMe);
            router.push('/');
        } catch (error) {
            setError(error.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left side - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-zinc-950">
                <div className="w-full max-w-md space-y-8">
                    {/* Logo */}
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

                    {/* Welcome Text */}
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">Welcome back</h1>
                        <p className="text-zinc-600 dark:text-zinc-400">Welcome back! Please enter your details.</p>
                    </div>

                    {/* Form */}
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
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:border-purple-500 focus:ring-purple-500 dark:text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-11 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:border-purple-500 focus:ring-purple-500 dark:text-white"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="remember"
                                    checked={rememberMe}
                                    onCheckedChange={setRememberMe}
                                    className="border-zinc-300 dark:border-zinc-600"
                                />
                                <label
                                    htmlFor="remember"
                                    className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                >
                                    Remember for 30 days
                                </label>
                            </div>
                            <Link
                                href="/auth/reset-password"
                                className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                            >
                                Forgot password
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </Button>
                    </form>

                    {/* Sign up link */}
                    <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                        Don&apos;t have an account?{' '}
                        <Link
                            href="/auth/register"
                            className="font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                        >
                            Sign up
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right side - Hero Image with Testimonial */}
            <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                <div className="absolute inset-0 flex items-center justify-center p-12">
                    <div className="relative w-full h-full max-w-2xl max-h-[800px] rounded-3xl overflow-hidden shadow-2xl">
                        {/* Background Image */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
                            <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6TTI0IDM0YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bTAtMTBjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS04IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00ek0xMiAzNGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bTAtMTBjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')]"></div>
                        </div>

                        {/* Cube Icon Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-64 h-64 opacity-10">
                                <svg viewBox="0 0 100 100" className="w-full h-full text-white">
                                    <path
                                        d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z M50 10 L50 50 M90 30 L50 50 M10 30 L50 50 M50 50 L50 90 M50 50 L90 70 M50 50 L10 70"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        fill="none"
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Testimonial Overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-12">
                            <div className="space-y-6">
                                <blockquote className="text-2xl font-semibold text-white leading-relaxed">
                                    &quot;MCUBES has transformed how we organize speedcubing competitions. The platform is intuitive, reliable, and loved by our community.&quot;
                                </blockquote>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-white text-lg">Alex Chen</div>
                                        <div className="text-gray-300 text-sm">Competition Organizer</div>
                                        <div className="text-gray-400 text-sm">World Cube Association</div>
                                    </div>

                                    <div className="flex gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                        ))}
                                    </div>
                                </div>

                                {/* Navigation Arrows */}
                                <div className="flex gap-2 mt-8">
                                    <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;