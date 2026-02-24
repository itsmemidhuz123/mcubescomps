'use client'

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TimerProvider } from '@/contexts/TimerContext';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, Menu, X, User, Moon, Sun, Users, Settings, Crown } from 'lucide-react';
// EventSelector moved to timer header; removed from global navbar.
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Logo URLs
const LOGO_LIGHT = "https://mcubescomps.s3.ap-south-1.amazonaws.com/mcubescomps/users/logo.png";
const LOGO_DARK = "https://mcubescomps.s3.ap-south-1.amazonaws.com/mcubescomps/users/MCUBES+logo+footer-01+(1).png";

const SUPER_ADMIN_EMAIL = 'midhun.speedcuber@gmail.com';

// Helper to check if user has moderator+ access (supports both new roleLevel and legacy role)
function hasModeratorAccess(userProfile) {
    if (!userProfile) return false;
    // Check for SUPER_ADMIN email directly
    if (userProfile.email?.toLowerCase() === SUPER_ADMIN_EMAIL) return true;
    // New system: check roleLevel
    if (userProfile.roleLevel !== undefined) {
        return userProfile.roleLevel >= 2;
    }
    // Legacy: check role field
    const role = userProfile.role?.toUpperCase();
    return role === 'MODERATOR' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// Helper to check if user has admin+ access
function hasAdminAccess(userProfile) {
    if (!userProfile) return false;
    if (userProfile.email?.toLowerCase() === SUPER_ADMIN_EMAIL) return true;
    if (userProfile.roleLevel !== undefined) {
        return userProfile.roleLevel >= 3;
    }
    const role = userProfile.role?.toUpperCase();
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// Helper to check if user has super admin access
function hasSuperAdminAccess(userProfile) {
    if (!userProfile) return false;
    if (userProfile.email?.toLowerCase() === SUPER_ADMIN_EMAIL) return true;
    if (userProfile.roleLevel !== undefined) {
        return userProfile.roleLevel >= 4;
    }
    return userProfile.role?.toUpperCase() === 'SUPER_ADMIN';
}

// Event selector is now rendered inside the timer header to ensure context

export function Navbar() {
    const { user, userProfile, signOut, isAdmin, isSuperAdmin, isModerator, hasPermission, loading } = useAuth();
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
        <header className="relative z-30 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md transition-colors duration-200">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo replaced with Event Selector for Timer */}
                <div className="flex items-center gap-2">
                    <Link href="/" className="flex items-center gap-2 group">
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
                </div>
                {/* Event selector relocated to header in timer mode - shown in TimerHeader component */}

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`text-sm font-medium transition-colors ${isActive(link.href)
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
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
                            className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </Button>
                    )}

                    {!loading && (
                        user ? (
                            <>
                                {hasModeratorAccess(userProfile) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400">
                                                <Shield className="w-5 h-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuLabel className="text-xs text-zinc-500">
                                                {hasSuperAdminAccess(userProfile) ? 'Super Admin' :
                                                    hasAdminAccess(userProfile) ? 'Admin' :
                                                        'Moderator'}
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => router.push('/admin')}>
                                                <Shield className="mr-2 h-4 w-4" /> Dashboard
                                            </DropdownMenuItem>
                                            {hasAdminAccess(userProfile) && (
                                                <DropdownMenuItem onClick={() => router.push('/admin/create')}>
                                                    <Shield className="mr-2 h-4 w-4" /> Create Competition
                                                </DropdownMenuItem>
                                            )}
                                            {hasAdminAccess(userProfile) && (
                                                <DropdownMenuItem onClick={() => router.push('/admin/users')}>
                                                    <Users className="mr-2 h-4 w-4" /> Manage Users
                                                </DropdownMenuItem>
                                            )}
                                            {hasSuperAdminAccess(userProfile) && (
                                                <DropdownMenuItem onClick={() => router.push('/admin/roles')}>
                                                    <Crown className="mr-2 h-4 w-4" /> Role Management
                                                </DropdownMenuItem>
                                            )}
                                            {hasSuperAdminAccess(userProfile) && (
                                                <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                                                    <Settings className="mr-2 h-4 w-4" /> Settings
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                                <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-700 mx-1" />

                                <Button
                                    variant="ghost"
                                    className="flex items-center gap-2 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    onClick={() => router.push('/profile')}
                                >
                                    <Avatar className="w-7 h-7">
                                        <AvatarImage src={userProfile?.photoURL} />
                                        <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs">
                                            {userProfile?.displayName?.[0] || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[100px] truncate">
                                        {userProfile?.displayName || 'User'}
                                    </span>
                                </Button>

                                <Button variant="ghost" size="icon" onClick={() => signOut()} title="Logout" className="text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
                                    <LogOut className="w-5 h-5" />
                                </Button>
                                {/* Timer Settings quick access */}
                                <Button variant="ghost" size="icon" onClick={() => router.push('/timer/settings')} title="Timer Settings" className="text-zinc-500 dark:text-zinc-400 hover:text-white">
                                    <Settings className="w-5 h-5" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/auth/login">
                                    <Button variant="ghost" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">Log in</Button>
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
                            className="text-zinc-600 dark:text-zinc-300"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </Button>
                    )}

                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-zinc-600 dark:text-zinc-300">
                                <Menu className="w-6 h-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white dark:bg-zinc-900">
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
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>

                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
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
                                                    <p className="font-medium text-zinc-900 dark:text-white">{userProfile?.displayName}</p>
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                                                </div>
                                            </div>

                                            <Button variant="outline" className="justify-start dark:border-zinc-700 dark:text-zinc-300" onClick={() => { router.push('/profile'); setIsOpen(false); }}>
                                                <User className="mr-2 h-4 w-4" /> Profile
                                            </Button>

                                            {hasModeratorAccess(userProfile) && (
                                                <>
                                                    <Button variant="outline" className="justify-start dark:border-zinc-700 dark:text-zinc-300" onClick={() => { router.push('/admin'); setIsOpen(false); }}>
                                                        <Shield className="mr-2 h-4 w-4" /> Admin Dashboard
                                                    </Button>
                                                    {hasAdminAccess(userProfile) && (
                                                        <Button variant="outline" className="justify-start dark:border-zinc-700 dark:text-zinc-300" onClick={() => { router.push('/admin/users'); setIsOpen(false); }}>
                                                            <Users className="mr-2 h-4 w-4" /> Manage Users
                                                        </Button>
                                                    )}
                                                    {hasSuperAdminAccess(userProfile) && (
                                                        <Button variant="outline" className="justify-start dark:border-zinc-700 dark:text-zinc-300" onClick={() => { router.push('/admin/roles'); setIsOpen(false); }}>
                                                            <Crown className="mr-2 h-4 w-4" /> Role Management
                                                        </Button>
                                                    )}
                                                </>
                                            )}

                                            <Button variant="ghost" className="justify-start text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => signOut()}>
                                                <LogOut className="mr-2 h-4 w-4" /> Log out
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <Link href="/auth/login" onClick={() => setIsOpen(false)}>
                                                <Button variant="outline" className="w-full dark:border-zinc-700 dark:text-zinc-300">Log in</Button>
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
