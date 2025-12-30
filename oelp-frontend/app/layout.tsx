import type { Metadata } from "next";
// Import the 'Inter' font from next/font
import { Inter } from "next/font/google";
import "./globals.css";

// Configure the 'Inter' font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OELP Code Runner",
  description: "Online Education Learning Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply the 'inter' font class to the body */}
      <body className={inter.className}>{children}</body>
    </html>
  );
}
