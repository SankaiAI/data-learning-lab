import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Claim ML CI/CD Lab',
  description: 'Enterprise CI/CD simulation for medical claim ML pipelines',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  )
}
