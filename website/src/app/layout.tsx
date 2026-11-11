import type { Metadata } from "next";
import { IBM_Plex_Sans, Roboto_Flex, Roboto, Roboto_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const robotoFlex = Roboto_Flex({
  variable: "--font-roboto-flex",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  display: "swap",
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
  title: "Clove | Own your AI",
  description:
    "Financial analysis, engineering, and reasoning through one OpenAI-compatible API. Explore task presets and custom models for your workflow.",
  metadataBase: new URL("https://www.cloveos.com"),
  openGraph: {
    title: "Clove | Own your AI",
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
      className={`${ibmPlexSans.variable} ${robotoFlex.variable} ${roboto.variable} ${robotoMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
