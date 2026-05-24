import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Micro-Course Builder",
  description: "Turn audience content into interactive micro-courses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50">
        <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: '12px', background: '#334155', color: '#fff', fontSize: '14px', fontWeight: '500' } }} />
        {children}
      </body>
    </html>
  );
}