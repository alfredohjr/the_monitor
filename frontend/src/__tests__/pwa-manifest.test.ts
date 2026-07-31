/**
 * Manifest do PWA (#319).
 *
 * Valida os campos que o Lighthouse exige para considerar o app instalável.
 * Sem eles o navegador simplesmente não oferece a instalação — e a falha é
 * silenciosa: nada quebra, o convite só nunca aparece.
 */
import fs from "fs";
import path from "path";

import manifest from "../app/manifest";

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

describe("ícone do iOS", () => {
  it("o apple-touch-icon existe e está referenciado no layout", () => {
    // O iOS não lê o manifest para isso; sem o <link> ele instala o app com um
    // print da página no lugar do ícone.
    expect(fs.existsSync(path.join(PUBLIC, "/icons/apple-touch-icon.png"))).toBe(true);

    const layout = fs.readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");
    expect(layout).toContain("/icons/apple-touch-icon.png");
  });
});
