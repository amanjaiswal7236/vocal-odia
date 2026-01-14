import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import { AppProvider } from "@/lib/context/AppContext";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "VocalOdia - Odia-English Voice Tutor",
  description: "AI-powered English learning platform for Odia speakers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <ToastProvider>
            <AppProvider>
        {children}
            </AppProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
