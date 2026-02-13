import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata = {
  title: 'MCUBES - Online Speedcubing Competitions',
  description: 'Participate in official-style online speedcubing competitions',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="dark">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
