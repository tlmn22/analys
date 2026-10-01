import type { Metadata, Viewport } from "next";
import { PwaInstall } from "@/components/pwa-install";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HoopsLab",
  description: "Data. Analyze. Elevate.",
  applicationName: "HoopsLab",
  appleWebApp: { capable: true, title: "HoopsLab", statusBarStyle: "default" },
  icons: { apple: "/icons/icon-180.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#047857" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ThemeProvider><PwaInstall />{children}</ThemeProvider></body>
    </html>
  );
}
