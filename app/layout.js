import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from "@/components/ui/toaster"
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata = {
  title: 'Mcubes Comps – Online Rubik’s Cube Competitions | Speedcubing Timer',
  description: 'Compete in online Rubik’s Cube live competitions, Speedcubing cube timer. Join global speedcubers, track rankings, and practice with official formats.',
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <AuthProvider>
          <Navbar />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}