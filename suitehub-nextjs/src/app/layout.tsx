import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TelegramAuthProvider } from "@/contexts/TelegramAuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SUITEHub - Your Personal Smart Display",
  description: "Turn any tablet or screen into a beautiful, customizable dashboard. Weather, calendar, todos, photos, and more.",
  manifest: "/manifest.json",
  themeColor: "#00D9FF",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SUITEHub",
  },
  openGraph: {
    title: "SUITEHub - Your Personal Smart Display",
    description: "Turn any tablet or screen into a beautiful, customizable dashboard.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TelegramAuthProvider>
          {children}
        </TelegramAuthProvider>
      </body>
    </html>
  );
}
