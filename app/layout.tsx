import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { brand, pageTitle } from "@/config/brand.config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.urls.site),
  title: {
    default: pageTitle(),
    template: `%s — ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.legalName,
  keywords: [
    "AI app builder",
    "React app generator",
    "prompt to app",
    "website to React",
    "AI developer tools",
  ],
  authors: [{ name: brand.company.name, url: brand.urls.site }],
  creator: brand.company.name,
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: pageTitle(),
    description: brand.promise,
    url: brand.urls.site,
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle(),
    description: brand.promise,
    creator: brand.social.twitter,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b12" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} font-sans`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: "var(--kiln-radius-sm)",
              border: "1px solid var(--kiln-surface-border)",
            },
          }}
        />
      </body>
    </html>
  );
}
