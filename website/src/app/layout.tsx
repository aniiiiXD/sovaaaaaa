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
  title: "Clove | APIs that do the job",
  description:
    "Financial analysis, engineering, and reasoning through one OpenAI-compatible API. Explore task presets and custom models for your workflow.",
  metadataBase: new URL("https://www.cloveos.com"),
  openGraph: {
    title: "Clove | APIs that do the job",
    description:
      "Choose a task. Send a question. Put the answer to work.",
    siteName: "Clove",
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
