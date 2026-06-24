import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const displayFont = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-dm-serif-display',
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
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
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
