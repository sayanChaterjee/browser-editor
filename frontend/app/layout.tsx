import type { Metadata } from "next";
import { connection } from "next/server";
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
import BackendBusy from "@/components/BackendBusy";
import NavigationProgress from "@/components/NavigationProgress";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "CEditor",
  description: "Write HTML, CSS and JavaScript with a live preview, in your browser.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render per request: each response's scripts need that request's CSP nonce (middleware.ts),
  // which a page prerendered at build time wouldn't have
  await connection();

  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalSecurity />
        <BackendBusy />
        <Suspense>
          <NavigationProgress />
        </Suspense>
        <DeviceRestriction>
          {children}
        </DeviceRestriction>
      </body>
    </html>
  );
}
