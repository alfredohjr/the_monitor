import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import CookieConsent from "@/components/layout/CookieConsent";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import VersionBadge from "@/components/layout/VersionBadge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quantified Self",
  description: "Track your objectives and performance.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Anti-flash (#225): define o tema antes da pintura. Enquanto o app não
            suporta o claro em TODAS as telas, o default é ESCURO — só a escolha
            explícita do usuário (localStorage) aplica o claro, para ninguém cair
            num meio-estado. A detecção do SO (prefers-color-scheme) volta no
            último ciclo, quando tudo estiver convertido. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();",
          }}
        />
        <Navbar />
        {children}
        <WhatsAppButton />
        <VersionBadge />
        <CookieConsent />
      </body>
    </html>
  );
}
