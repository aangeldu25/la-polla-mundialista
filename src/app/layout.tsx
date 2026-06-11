import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ConsentBanner } from "@/components/layout/ConsentBanner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const APP_URL = "https://la-polla-mundialista-2026-seven.vercel.app";
const DESCRIPTION =
  "La polla del Mundial 2026 para jugar con tu gente. Predice, compite y celebra.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Polla Mundialista 2026",
  description: DESCRIPTION,
  applicationName: "Polla 2026",
  authors: [{ name: "Polla Mundialista 2026" }],
  // favicon/apple-icon: servidos automáticamente por Next desde
  // src/app/icon.png y src/app/apple-icon.png
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "Polla Mundialista 2026",
    title: "Polla Mundialista 2026 ⚽",
    description: DESCRIPTION,
    locale: "es_CO",
    images: [
      {
        url: "/og-wide.png",
        width: 1024,
        height: 512,
        alt: "Polla Mundialista 2026 — Copa del Mundo",
      },
      {
        url: "/og-square.png",
        width: 871,
        height: 871,
        alt: "Polla Mundialista 2026 — Copa del Mundo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Polla Mundialista 2026 ⚽",
    description: DESCRIPTION,
    images: ["/og-wide.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0033a0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <ConsentBanner />
      </body>
    </html>
  );
}
