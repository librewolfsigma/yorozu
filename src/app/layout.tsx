import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Yozora — Universal 18+ Media Platform",
  description:
    "Yozora is a demo adult-only (18+) universal media platform: anime, manga, manhwa, illustrations, AV, games, scripts and more — unified database, Mihon-inspired provider extensions, Hikari-inspired design.",
  robots: { index: false, follow: false },
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "var(--background)",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lalezar&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
