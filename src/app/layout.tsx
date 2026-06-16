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
    "Download videos from TikTok, Instagram, YouTube, Facebook & X in HD/4K. Or let AI extract recipes, destinations, brands, and key insights from any video. Free forever.",
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
      "Paste a link. Get your video in HD/4K. Or let AI extract recipes, destinations, and key insights.",
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
      "Paste a link. Get your video in HD/4K. Or let AI extract recipes, destinations, and key insights.",
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
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* PostHog Analytics */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
          posthog.init('phc_YOUR_PROJECT_API_KEY',{api_host:'https://app.posthog.com'})`,
          }}
        />
        {/* Sentry */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.sentryOnLoad = function() { Sentry.init({ dsn: "https://YOUR_SENTRY_DSN@o0.ingest.sentry.io/0" }); };`,
          }}
        />
      </head>
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
