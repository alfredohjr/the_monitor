/**
 * Manifest do PWA (#319).
 *
 * Valida os campos que o Lighthouse exige para considerar o app instalável.
 * Sem eles o navegador simplesmente não oferece a instalação — e a falha é
 * silenciosa: nada quebra, o convite só nunca aparece.
 */
import fs from "fs";
import path from "path";

// O layout importa fontes do next/font, que exigem o compilador do Next para
// resolver — em jest o loader não roda. O mock devolve só o que o layout usa
// (a `variable` que vai pro className), o que basta para o módulo carregar e
// os exports de metadata ficarem inspecionáveis de verdade.
jest.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

import manifest from "../app/manifest";
import { metadata, viewport } from "../app/layout";

const PUBLIC = path.resolve(__dirname, "../../public");

describe("manifest", () => {
  const m = manifest();

  it("tem os campos obrigatórios de instalabilidade", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.display).toBe("standalone");
  });

  it("short_name cabe embaixo do ícone (limite prático de 12 caracteres)", () => {
    // Android trunca o rótulo na tela inicial; acima disso vira reticências.
    expect(m.short_name!.length).toBeLessThanOrEqual(12);
  });

  it("tem ícone 192 e 512", () => {
    const tamanhos = (m.icons ?? []).map((i) => i.sizes);
    expect(tamanhos).toContain("192x192");
    expect(tamanhos).toContain("512x512");
  });

  it("tem ao menos um ícone maskable", () => {
    // Sem maskable o Android recorta o ícone num círculo e come as bordas.
    const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThan(0);
  });

  it("todos os arquivos de ícone existem em public/", () => {
    // Manifest apontando para arquivo inexistente passa em qualquer validação
    // de forma e falha na instalação real.
    const faltando = (m.icons ?? [])
      .map((i) => i.src as string)
      .filter((src) => !fs.existsSync(path.join(PUBLIC, src)));
    expect(faltando).toEqual([]);
  });

  it("start_url aponta para uma rota que existe", () => {
    // `/dashboard` sobrevive à renomeação de rotas das #311-#313 porque já era
    // inglês. Um start_url quebrado abre o app instalado num 404.
    const rota = m.start_url!.replace(/^\//, "");
    const dir = path.resolve(__dirname, "../app", rota);
    expect(fs.existsSync(path.join(dir, "page.tsx"))).toBe(true);
  });

  it("as cores acompanham o tema escuro, que é o default do app", () => {
    expect(m.background_color).toBe("#0a0a0a");
    expect(m.theme_color).toBe("#0a0a0a");
  });

  it("nome e descrição vêm do catálogo, não hardcoded", () => {
    const { t } = require("@/lib/i18n");
    expect(m.name).toBe(t("pwa.name"));
    expect(m.description).toBe(t("pwa.description"));
  });
});

describe("viewport (#320)", () => {
  it("themeColor é exatamente o theme_color do manifest", () => {
    // Divergência aqui não quebra nada — só pinta a barra de status de uma cor
    // na abertura e de outra depois que o manifest é lido, um flash visível.
    expect(viewport.themeColor).toBe(manifest().theme_color);
  });

  it("ocupa a largura do dispositivo sem zoom inicial", () => {
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
  });

  it("usa viewportFit cover, para o app chegar embaixo do notch", () => {
    // Sem `cover` o iOS reserva faixas nas bordas seguras e o app instalado fica
    // com tarjas da cor de fundo em vez de ocupar a tela.
    expect(viewport.viewportFit).toBe("cover");
  });
});

describe("appleWebApp (#320)", () => {
  it("declara o app como standalone no iOS", () => {
    // É por este bloco que o iPhone abre o ícone da tela inicial sem a barra do
    // Safari. O manifest não tem efeito nisso.
    expect(metadata.appleWebApp).toMatchObject({ capable: true });
  });

  it("a barra de status acompanha o tema escuro", () => {
    const { statusBarStyle } = metadata.appleWebApp as { statusBarStyle?: string };
    expect(statusBarStyle).toBe("black-translucent");
  });

  it("o título vem do catálogo, não hardcoded", () => {
    const { t } = require("@/lib/i18n");
    const { title } = metadata.appleWebApp as { title?: string };
    expect(title).toBe(t("pwa.shortName"));
  });
});

describe("o layout do #225 segue intacto", () => {
  // Esta issue só acrescenta exports. O script anti-flash roda antes da pintura
  // e é o que evita a tela branca piscando no tema escuro; perdê-lo num
  // refactor de metadata seria uma regressão silenciosa e visível.
  const layout = fs.readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");

  it("mantém o script anti-flash de tema e idioma", () => {
    expect(layout).toContain("localStorage.getItem('theme')");
    expect(layout).toContain("localStorage.getItem('locale')");
  });

  it("mantém o data-theme=dark no <html>", () => {
    expect(layout).toContain('data-theme="dark"');
  });
});

describe("ícone do iOS", () => {
  it("o apple-touch-icon existe e está referenciado no layout", () => {
    // O iOS não lê o manifest para isso; sem o <link> ele instala o app com um
    // print da página no lugar do ícone.
    expect(fs.existsSync(path.join(PUBLIC, "/icons/apple-touch-icon.png"))).toBe(true);

    const layout = fs.readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");
    expect(layout).toContain("/icons/apple-touch-icon.png");
  });
});
