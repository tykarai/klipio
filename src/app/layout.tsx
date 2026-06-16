import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/Toaster";

export const metadata: Metadata = {
  title: {
    default: "Klipio — Download & Understand Any Video",
    template: "%s | Klipio",
  },
  description:
    "Paste a social video link. Download the media or let Klipio extract recipes, destinations, products, and key insights from the clip.",
  keywords: [
    "video downloader",
    "TikTok downloader",
    "Instagram downloader",
    "YouTube downloader",
    "AI video analysis",
    "video to recipe",
    "video to travel guide",
    "no watermark",
    "HD download",
    "4K download",
  ],
  authors: [{ name: "Klipio" }],
  creator: "Klipio",
  publisher: "Klipio",
  robots: "index, follow",
  metadataBase: new URL("https://klipio.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://klipio.io",
    siteName: "Klipio",
    title: "Klipio — Download & Understand Any Video",
    description:
      "Paste a social video link. Download the media or turn the clip into structured knowledge.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Klipio — Download & Understand Any Video",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Klipio — Download & Understand Any Video",
    description:
      "Paste a social video link. Download the media or turn the clip into structured knowledge.",
    images: ["/og-image.jpg"],
    creator: "@klipio",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#F7F6FB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-klipio-bg text-klipio-text min-h-screen`}
      >
        <div className="relative min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
