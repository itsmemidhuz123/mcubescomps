import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from "@/components/ui/toaster"
import { Navbar } from '@/components/Navbar';
import Footer from '@/components/Footer';
import Script from 'next/script';
import './globals.css';

export const metadata = {
    title: "Mcubes Comps – Online Rubik's Cube Competitions | Speedcubing Timer",
    description: "Compete in online Rubik's Cube live competitions, Speedcubing cube timer. Join global speedcubers, track rankings, and practice with official formats.",
    icons: {
        icon: '/icon.png',
        shortcut: '/favicon.png',
        apple: '/icon.png',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body suppressHydrationWarning className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white antialiased min-h-screen flex flex-col">
                <ThemeProvider>
                    <AuthProvider>
                        <Navbar />
                        <main className="flex-1">
                            {children}
                        </main>
                        <Footer />
                        <Toaster />
                    </AuthProvider>
                </ThemeProvider>
                <Script async src="https://www.googletagmanager.com/gtag/js?id=G-ZK53H9N420" />
                <Script id="google-analytics">
                    {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-ZK53H9N420');`}
                </Script>
                <Script id="clarity" type="text/javascript">
                    {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "qg1lwxcmlo");`}
                </Script>
            </body>
        </html>
    );
}