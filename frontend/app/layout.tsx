import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import DeviceRestriction from "@/components/DeviceRestriction";
import GlobalSecurity from "@/components/GlobalSecurity";

export const metadata: Metadata = {
  title: "CEditor",
  description: "Write HTML, CSS and JavaScript with a live preview, in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalSecurity />
        <DeviceRestriction>
          {children}
        </DeviceRestriction>
      </body>
    </html>
  );
}
