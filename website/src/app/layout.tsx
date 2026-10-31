import type { Metadata } from "next";
import { Geist, Roboto_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SOVA | Sovereign inference for the world",
  description:
    "SOVA runs your work on models proven against your own evals: frontier quality without frontier bills, on infrastructure you control. Evals, specialist models, and an engineer on your account.",
  metadataBase: new URL("https://sova-native.vercel.app"),
  openGraph: {
    title: "SOVA · Sovereign inference for the world",
    description:
      "Your workflows deserve their own model. Evals first, specialist models second, engineers on account, on infrastructure you control.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${robotoMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
