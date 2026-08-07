import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Manrope, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const displayFont = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-dm-serif-display',
});

// App-wide body/UI font.
const bodyFont = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-app-sans',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'LearnMate - Learn Through Conversation',
  description: 'Learn any technology through conversation. Get structured notes in Notion.',
  generator: 'v0.app',
  icons: {
    // Single self-contained brand SVG — sharp at every size, works on light/dark.
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="bg-background dark"
      style={{ colorScheme: 'dark' }}
      suppressHydrationWarning
    >
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
