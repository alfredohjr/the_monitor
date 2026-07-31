import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import CookieConsent from "@/components/layout/CookieConsent";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import VersionBadge from "@/components/layout/VersionBadge";
import ServiceWorkerRegistration from "@/components/layout/ServiceWorkerRegistration";
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
  icons: {
    icon: "/favicon.svg",
    // O iOS ignora o manifest para o ícone da tela inicial — ele lê o
    // <link rel="apple-touch-icon">. Sem isto, o iPhone instala o app com um
    // print da página no lugar do ícone (#319).
    apple: "/icons/apple-touch-icon.png",
  },
  // O iOS não lê o manifest: é este bloco que faz o ícone da tela inicial abrir
  // sem a barra do Safari. `title` é o rótulo embaixo do ícone — o mesmo
  // `short_name` do manifest, para o app não ter dois nomes conforme o sistema.
  appleWebApp: {
    capable: true,
    // `black-translucent` deixa o conteúdo passar por baixo da barra de status,
    // que é o par de `viewportFit: "cover"` abaixo. Com `default` (branco) o
    // topo da tela ficaria claro em cima de uma interface escura.
    statusBarStyle: "black-translucent",
    title: t("pwa.shortName"),
  },
};

// Cor da barra de status enquanto o app abre.
//
// Precisa ser IGUAL ao `theme_color` do manifest (`app/manifest.ts`): o
// navegador usa este valor na abertura e o do manifest depois de instalado, e
// dois valores diferentes viram um flash de cor na transição. O teste em
// `pwa-manifest.test.ts` compara os dois — se um mudar sozinho, ele acusa.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // `cover` estende o app até as bordas físicas em telas com notch. Sem isto o
  // iOS reserva as áreas seguras e sobra uma tarja da cor de fundo em cima e
  // embaixo — o jeito mais rápido de o app instalado parecer uma página web.
  viewportFit: "cover",
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
        <ServiceWorkerRegistration />
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
