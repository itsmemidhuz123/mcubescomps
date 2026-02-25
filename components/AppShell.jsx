'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AppShell({ children }) {
    const pathname = usePathname();
    const isTimerPage = pathname?.startsWith('/timer');

    return (
        <>
            {!isTimerPage && <Navbar />}
            <main className="flex-1">
                {children}
            </main>
            {!isTimerPage && <Footer />}
        </>
    );
}
