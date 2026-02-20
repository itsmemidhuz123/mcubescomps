'use client'

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, Menu, X, User, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Logo URLs
const LOGO_LIGHT = "https://mcubescomps.s3.ap-south-1.amazonaws.com/mcubescomps/users/logo.png";
const LOGO_DARK = "https://mcubescomps.s3.ap-south-1.amazonaws.com/mcubescomps/users/MCUBES+logo+footer-01+(1).png";

export function Navbar() {
    const { user, userProfile, signOut, isAdmin, loading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/competitions', label: 'Competitions' },
        { href: '/rankings', label: 'Rankings' },
    ];

    const isActive = (path) => pathname === path;

    return (
        <header className="w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md transition-colors duration-200">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="relative h-10 w-40">
                        <img
                            src={LOGO_LIGHT}
                            alt="MCUBES"
                            className="h-full w-full object-contain object-left dark:hidden"
                        />
                        <img
                            src={LOGO_DARK}
                            alt="MCUBES"
                            className="h-full w-full object-contain object-left hidden dark:block"
                        />
                    </div>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`text-sm font-medium transition-colors ${isActive(link.href)
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Desktop Auth & Theme Toggle */}
                <div className="hidden md:flex items-center gap-3">
                    {/* Theme Toggle */}
                    {mounted && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </Button>
                    )}

                    {!loading && (
                        user ? (
                            <>
                                {isAdmin && (
                                    <Button variant="ghost" size="icon" onClick={() => router.push('/admin')} title="Admin Panel" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                                        <Shield className="w-5 h-5" />
                                    </Button>
                                )}

                                <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />

                                <Button
                                    variant="ghost"
                                    className="flex items-center gap-2 px-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    onClick={() => router.push('/profile')}
                                >
                                    <Avatar className="w-7 h-7">
                                        <AvatarImage src={userProfile?.photoURL} />
                                        <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs">
                                            {userProfile?.displayName?.[0] || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[100px] truncate">
                                        {userProfile?.displayName || 'User'}
                                    </span>
                                </Button>

                                <Button variant="ghost" size="icon" onClick={() => signOut()} title="Logout" className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                                    <LogOut className="w-5 h-5" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/auth/login">
                                    <Button variant="ghost" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Log in</Button>
                                </Link>
                                <Link href="/auth/register">
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">Sign up</Button>
                                </Link>
                            </>
                        )
                    )}
                </div>

                {/* Mobile Menu */}
                <div className="md:hidden flex items-center gap-2">
                    {/* Mobile Theme Toggle */}
                    {mounted && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            className="text-gray-600 dark:text-gray-300"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </Button>
                    )}

                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300">
                                <Menu className="w-6 h-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white dark:bg-gray-950">
                            <div className="flex flex-col gap-6 py-6">
                                <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
                                    <div className="relative h-10 w-32">
                                        <img
                                            src={LOGO_LIGHT}
                                            alt="MCUBES"
                                            className="h-full w-full object-contain object-left dark:hidden"
                                        />
                                        <img
                                            src={LOGO_DARK}
                                            alt="MCUBES"
                                            className="h-full w-full object-contain object-left hidden dark:block"
                                        />
                                    </div>
                                </Link>

                                <div className="flex flex-col gap-3">
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setIsOpen(false)}
                                            className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${isActive(link.href)
                                                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                                    {user ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-3 px-4 py-2">
                                                <Avatar>
                                                    <AvatarImage src={userProfile?.photoURL} />
                                                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                                        {userProfile?.displayName?.[0] || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{userProfile?.displayName}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                                </div>
                                            </div>

                                            <Button variant="outline" className="justify-start dark:border-gray-700 dark:text-gray-300" onClick={() => { router.push('/profile'); setIsOpen(false); }}>
                                                <User className="mr-2 h-4 w-4" /> Profile
                                            </Button>

                                            {isAdmin && (
                                                <Button variant="outline" className="justify-start dark:border-gray-700 dark:text-gray-300" onClick={() => { router.push('/admin'); setIsOpen(false); }}>
                                                    <Shield className="mr-2 h-4 w-4" /> Admin Panel
                                                </Button>
                                            )}

                                            <Button variant="ghost" className="justify-start text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => signOut()}>
                                                <LogOut className="mr-2 h-4 w-4" /> Log out
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <Link href="/auth/login" onClick={() => setIsOpen(false)}>
                                                <Button variant="outline" className="w-full dark:border-gray-700 dark:text-gray-300">Log in</Button>
                                            </Link>
                                            <Link href="/auth/register" onClick={() => setIsOpen(false)}>
                                                <Button className="w-full bg-blue-600 hover:bg-blue-700">Sign up</Button>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}