import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import CookieConsent from "@/components/layout/CookieConsent";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import VersionBadge from "@/components/layout/VersionBadge";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { t } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata ESTÁTICO, no idioma padrão do app, com o texto vindo do catálogo.
//
// Cheguei a implementar `generateMetadata` lendo o Accept-Language — funciona,
// mas `headers()` no layout raiz opta o app INTEIRO fora da geração estática:
// medi 24 páginas estáticas antes e 1 depois. Trocar isso por uma
// <meta description> traduzida não se paga, e a linguagem da INTERFACE já é
// resolvida no cliente pelo provider e pelo script anti-flash do <html lang>.
//
// "themonitor" é marca e não se traduz.
export const metadata: Metadata = {
  title: "themonitor",
  description: t("layout.metaDescription"),
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
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
              "(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');" +
              // Mesmo motivo do tema, aplicado ao idioma (#278): o <html lang> sai
              // do servidor em 'en' e o provider só corrigiria depois da hidratação.
              // Leitor de tela lê o lang antes disso — daí resolver antes da pintura.
              "var l=localStorage.getItem('locale');document.documentElement.setAttribute('lang',l==='pt-BR'?'pt-BR':'en');}catch(e){}})();",
          }}
        />
        <I18nProvider>
          <Navbar />
          {children}
          <WhatsAppButton />
          <VersionBadge />
          <CookieConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
