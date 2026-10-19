import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Audit LOR Tracker",
  description: "List of Requirements workflow for internal audit — requests, uploads, reviews and timeline.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased min-h-screen">
        <Nav />
        <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
