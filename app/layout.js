import './globals.css'

export const metadata = {
  title: 'SpeedCube Online - Official Speedcubing Competitions',
  description: 'Participate in official-style online speedcubing competitions with WCA format',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
