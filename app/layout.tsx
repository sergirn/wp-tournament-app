import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"
import { PwaRegister } from "@/components/pwa-register"

const baiJamjuree = localFont({
  src: [
    { path: "../public/fonts/bai-jamjuree-400.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/bai-jamjuree-500.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/bai-jamjuree-600.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/bai-jamjuree-700.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-bai-jamjuree",
})

export const metadata: Metadata = {
  title: "Waterpolo Manager - Sistema de Gestión de Torneos",
  description: "Aplicación profesional para gestionar torneos de waterpolo, actas de partidos y estadísticas",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  applicationName: "Waterpolo Pro",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Waterpolo Pro" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
    >
      <body className={`${baiJamjuree.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <PwaRegister />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
