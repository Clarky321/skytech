import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { themeScript } from '@/components/theme';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/menu';
import './globals.css';

// next/font downloads the fonts at build time and serves them from our own origin.
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' });
const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'SkyTech — технический портал для IT-инженеров', template: '%s — SkyTech' },
  description:
    'Практические инструкции, статьи и инструменты для системных администраторов, сетевых инженеров и DevOps.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfcfd' },
    { media: '(prefers-color-scheme: dark)', color: '#14171f' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body>
        {/* Static first-paint theme script (no user data), injected before hydration. */}
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
