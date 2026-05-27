import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentFloat — Yield routing that learns",
  description:
    "A Uniswap v4 hook on X Layer. Out-of-range LP capital flows into a yield vault that runs multiple strategies in parallel. An AI proposes new ones every hour; only proven winners ship.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
