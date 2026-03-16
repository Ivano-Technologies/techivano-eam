import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Techivano | Infrastructure Operations Intelligence Platform",
    template: "%s | Techivano",
  },
  description:
    "Government-grade Infrastructure Operations Intelligence Platform. Enterprise asset management, predictive maintenance, and operations intelligence for federal agencies, state governments, and regulators.",
  keywords: [
    "Enterprise Asset Management",
    "Infrastructure Asset Management",
    "Predictive Maintenance Platform",
    "Government Infrastructure Management",
    "EAM",
    "GovTech",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Techivano",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
