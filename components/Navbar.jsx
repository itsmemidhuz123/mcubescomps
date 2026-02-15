'use client'

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, Menu, X, User } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Navbar() {
  const { user, userProfile, signOut, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Check if we are on the profile page to adjust styling if needed (though profile has its own header usually)
  // For consistency, we'll use a white header for all pages except maybe profile if it keeps its unique look.
  // The user requested "Same header across", but Profile was "already good". 
  // We will assume Profile keeps its specific dark header for now to preserve its look, 
  // OR we use this Navbar and make it adaptive. 
  // Given "Profile is already good", I will let Profile keep its header or replacing it might break the dark aesthetic.
  // However, for "Same header across", I should probably use this one. 
  // Let's stick to using this for the requested pages: Home, Competitions, Rankings, Admin.

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/competitions', label: 'Competitions' },
    { href: '/rankings', label: 'Rankings' },
  ];

  const isActive = (path) => pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold text-sm shadow-md group-hover:shadow-lg transition-all">
            M
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">MCUBES</span>
        </Link>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`text-sm font-medium transition-colors ${
                isActive(link.href) 
                  ? 'text-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-3">
          {!loading && (
            user ? (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => router.push('/admin')} title="Admin Panel" className="text-gray-500 hover:text-blue-600">
                    <Shield className="w-5 h-5" />
                  </Button>
                )}
                
                <div className="h-6 w-[1px] bg-gray-200 mx-1" />
                
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 px-2 hover:bg-gray-100"
                  onClick={() => router.push('/profile')}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={userProfile?.photoURL} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                      {userProfile?.displayName?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
                    {userProfile?.displayName || 'User'}
                  </span>
                </Button>

                <Button variant="ghost" size="icon" onClick={() => signOut()} title="Logout" className="text-gray-500 hover:text-red-600">
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" className="text-gray-600 hover:text-gray-900">Log in</Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">Sign up</Button>
                </Link>
              </>
            )
          )}
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-600">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-6 py-6">
                <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
                   <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-sm">M</div>
                   <span className="font-bold text-lg text-gray-900">MCUBES</span>
                </Link>
                
                <div className="flex flex-col gap-3">
                  {navLinks.map((link) => (
                    <Link 
                      key={link.href} 
                      href={link.href} 
                      onClick={() => setIsOpen(false)}
                      className={`text-lg font-medium px-4 py-2 rounded-md transition-colors ${
                        isActive(link.href) 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-6">
                  {user ? (
                    <div className="flex flex-col gap-3">
                       <div className="flex items-center gap-3 px-4 py-2">
                          <Avatar>
                            <AvatarImage src={userProfile?.photoURL} />
                            <AvatarFallback>{userProfile?.displayName?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                             <p className="font-medium text-gray-900">{userProfile?.displayName}</p>
                             <p className="text-sm text-gray-500 truncate">{user.email}</p>
                          </div>
                       </div>
                       
                       <Button variant="outline" className="justify-start" onClick={() => { router.push('/profile'); setIsOpen(false); }}>
                          <User className="mr-2 h-4 w-4" /> Profile
                       </Button>
                       
                       {isAdmin && (
                         <Button variant="outline" className="justify-start" onClick={() => { router.push('/admin'); setIsOpen(false); }}>
                            <Shield className="mr-2 h-4 w-4" /> Admin Panel
                         </Button>
                       )}
                       
                       <Button variant="ghost" className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => signOut()}>
                          <LogOut className="mr-2 h-4 w-4" /> Log out
                       </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Link href="/auth/login" onClick={() => setIsOpen(false)}>
                        <Button variant="outline" className="w-full">Log in</Button>
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