/**
 * Configuração do Digital Asset Links (#329).
 *
 * Mora na suíte do frontend porque é a que roda em todo PR e já lê arquivos de
 * fora (o `push.test.tsx` confere Dockerfile e release.yml pelo mesmo motivo).
 * O conteúdo verificado é de deploy, não de frontend.
 *
 * A razão de existir: se a rota do Caddy sumir num refactor, **nada falha**. O
 * site continua no ar, o app da Play Store continua abrindo — só que com a
 * barra de endereço do Chrome à mostra, parecendo navegador em vez de app. Um
 * defeito que só aparece para quem instalou pela loja.
 */
import fs from "fs";
import path from "path";

const DEPLOY = path.resolve(__dirname, "../../../deploy/vps");

const caddyfiles = ["Caddyfile", "Caddyfile.tunnel"];

describe("assetlinks.json", () => {
  const bruto = fs.readFileSync(path.join(DEPLOY, "well-known/assetlinks.json"), "utf8");

  it("é JSON válido", () => {
    // JSON quebrado faz o Android descartar o arquivo INTEIRO, sem aviso.
    expect(() => JSON.parse(bruto)).not.toThrow();
  });

  it("declara a relação que o TWA exige", () => {
    const [entrada] = JSON.parse(bruto);
    expect(entrada.relation).toContain("delegate_permission/common.handle_all_urls");
    expect(entrada.target.namespace).toBe("android_app");
    expect(entrada.target.package_name).toBeTruthy();
  });

  it("tem um lugar para o fingerprint", () => {
    const [entrada] = JSON.parse(bruto);
    expect(Array.isArray(entrada.target.sha256_cert_fingerprints)).toBe(true);
    expect(entrada.target.sha256_cert_fingerprints).toHaveLength(1);
  });
});

describe("rota no Caddy", () => {
  // As DUAS variantes: o projeto usa a B (tunnel) hoje, mas a A continua
  // suportada, e configurar só uma deixaria a outra quebrada em silêncio.
  it.each(caddyfiles)("%s serve /.well-known/assetlinks.json", (arquivo) => {
    const conf = fs.readFileSync(path.join(DEPLOY, arquivo), "utf8");
    expect(conf).toContain("handle /.well-known/assetlinks.json");
    expect(conf).toMatch(/root \* \/etc\/caddy\/well-known/);
  });

  it.each(caddyfiles)("%s responde antes do proxy do frontend", (arquivo) => {
    // O `handle` catch-all manda tudo para o Next; se ele viesse primeiro, o
    // assetlinks viraria um 404 do frontend.
    const conf = fs.readFileSync(path.join(DEPLOY, arquivo), "utf8");
    expect(conf.indexOf("/.well-known/assetlinks.json")).toBeLessThan(conf.indexOf("reverse_proxy frontend"));
  });

  it("o compose monta o diretório no container do Caddy", () => {
    // Sem o volume, a rota existe e devolve 404 — pior que não ter rota, porque
    // parece configurado.
    const compose = fs.readFileSync(path.join(DEPLOY, "docker-compose.yml"), "utf8");
    expect(compose).toContain("./well-known:/etc/caddy/well-known:ro");
  });
});

// ---------------------------------------------------------------------------
// Empacotamento TWA (#330)
// ---------------------------------------------------------------------------

describe("segurança do diretório do TWA", () => {
  const gitignore = fs.readFileSync(path.resolve(__dirname, "../../../deploy/twa/.gitignore"), "utf8");

  it.each(["*.keystore", "*.jks", "*.p12"])("ignora %s", (padrao) => {
    // Quem tem o keystore publica atualização em nome deste app. E commit de
    // credencial não se desfaz apagando o commit — fica no histórico, nos
    // forks e nos clones de quem já puxou.
    expect(gitignore).toContain(padrao);
  });

  it("ignora os artefatos de build", () => {
    expect(gitignore).toContain("*.aab");
    expect(gitignore).toContain("*.apk");
  });

  it("NÃO ignora o twa-manifest.json — ele é a configuração, não artefato", () => {
    // Sem ele versionado, quem gerar o próximo build precisa adivinhar o
    // packageId e a versão escolhidos no primeiro.
    expect(gitignore).not.toMatch(/^twa-manifest\.json/m);
  });

  it("nenhum keystore foi commitado", () => {
    // A guarda que importa de verdade: o .gitignore certo não ajuda se um
    // arquivo entrou antes de ele existir.
    const twa = path.resolve(__dirname, "../../../deploy/twa");
    const suspeitos = fs
      .readdirSync(twa)
      .filter((f: string) => /\.(keystore|jks|p12)$/.test(f));
    expect(suspeitos).toEqual([]);
  });
});
