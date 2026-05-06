import type React from "react"
import type { Metadata } from "next"
import { Raleway } from "next/font/google"
import { ThemeProvider } from "@/components/ui/theme-provider"
import "./globals.css"

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://govbidder.com"),
  title: {
    default:  "GovBidder",
    template: "%s · GovBidder",
  },
  description: "Government Contracts Intelligence Platform",
  // Favicon auto-detected from app/icon.png (Next.js convention).
  // Don't redeclare here — Next will generate the proper <link> tags.
  openGraph: {
    title: "GovBidder Sales Dashboard",
    description: "Government Contracts Intelligence Platform",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "GovBidder Sales Dashboard" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GovBidder Sales Dashboard",
    description: "Government Contracts Intelligence Platform",
    images: ["/og-image.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={raleway.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
