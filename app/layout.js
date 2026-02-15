import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from "@/components/ui/toaster"
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata = {
  title: 'MCUBES - Online Speedcubing Competitions',
  description: 'Participate in official-style online speedcubing competitions',
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