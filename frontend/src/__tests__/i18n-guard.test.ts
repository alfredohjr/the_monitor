/**
 * Guardas de i18n (#315).
 *
 * Duas varreduras, cada uma nascida de um problema que aconteceu de verdade
 * durante a migração das 19 telas — não de hipótese.
 *
 * A primeira versão usava regex sobre o código cru e não funcionou: `>` e `<`
 * aparecem em generics (`useState<T>`) e arrow functions, não só em tags JSX,
 * o que produziu 203 falsos positivos. Guarda que exige allowlist de 203
 * entradas é decoração. Esta versão usa o parser do TypeScript.
 */
import fs from "fs";
import path from "path";
import ts from "typescript";

const SRC = path.resolve(__dirname, "..");

function arquivos(dir: string, filtro: (p: string) => boolean): string[] {
  const saida: string[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) saida.push(...arquivos(p, filtro));
    else if (filtro(p)) saida.push(p);
  }
  return saida;
}

const rel = (p: string) => path.relative(SRC, p);

// ---------------------------------------------------------------------------
// 1. Texto visível fora do catálogo
// ---------------------------------------------------------------------------

// Cada entrada precisa de justificativa. Allowlist que cresce sem explicação
// transforma a guarda em decoração — pior que não ter, porque dá impressão de
// cobertura onde não há.
const PERMITIDOS = new Set([
  "themonitor",   // marca
  "BRL (R$)",     // código e símbolo de moeda, não texto
  "USD ($)",
  "EUR (€)",
  "••••••••",     // máscara de senha
  "dark",         // valor de tema (useState), não texto de tela
  "light",
  "loading",      // enum de status (useState)
  "success",
  "error",
  "BRL",          // código de moeda em useState, não texto de tela
  "all",          // valor do filtro "todas as métricas" no dashboard
]);

// Atributos que um leitor de tela ou o usuário efetivamente lê.
const ATRIBUTOS_VISIVEIS = new Set(["placeholder", "title", "aria-label", "alt"]);

const TEM_PALAVRA = /[A-Za-zÀ-ÿ]{3,}/;

function textosVisiveis(arquivo: string): string[] {
  const src = ts.createSourceFile(
    arquivo,
    fs.readFileSync(arquivo, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const achados: string[] = [];

  const visita = (n: ts.Node): void => {
    // (a) texto entre tags
    if (ts.isJsxText(n)) {
      const t = n.text.replace(/\s+/g, " ").trim();
      if (t) achados.push(t);
    }

    // (b) atributo visível com string literal
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const nome = n.name.getText();
      if (ATRIBUTOS_VISIVEIS.has(nome)) achados.push(n.initializer.text);
    }

    // (c) estado inicial com string — o #284 achou "Verificando seu e-mail..."
    //     aqui, que não aparece em (a) nem em (b).
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "useState" &&
      n.arguments.length === 1 &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      achados.push((n.arguments[0] as ts.StringLiteral).text);
    }

    ts.forEachChild(n, visita);
  };

  visita(src);
  return achados;
}

test('nenhum texto visível fora do catálogo nos componentes', () => {
  const alvos = arquivos(SRC, (p) => p.endsWith(".tsx") && !p.includes("__tests__"));
  const achados: string[] = [];

  for (const f of alvos) {
    for (const texto of textosVisiveis(f)) {
      if (!TEM_PALAVRA.test(texto)) continue;   // só pontuação, número ou símbolo
      if (PERMITIDOS.has(texto)) continue;
      achados.push(`${rel(f)}: ${JSON.stringify(texto)}`);
    }
  }

  expect(achados).toEqual([]);
});

// ---------------------------------------------------------------------------
// Por que NÃO há uma segunda guarda automática aqui
// ---------------------------------------------------------------------------
//
// O dano mais caro da migração não foi literal esquecido, foi este padrão:
//
//   await waitFor(() => expect(queryByText(/vazio/i)).not.toBeInTheDocument());
//   expect(screen.getByText('valor')).toBeInTheDocument();
//
// O waitFor não é asserção — é o sinal de "os dados chegaram". Quando o texto do
// estado vazio muda, o matcher para de casar, o waitFor resolve no primeiro tick
// e a asserção seguinte roda contra a tela vazia. No #292, duas dessas guardavam
// permissão de edição de lançamento; no #294, o teste dos KPIs removidos.
//
// Tentei automatizar. Uma varredura por `waitFor` com `.not` acusa 17 lugares, e
// boa parte é LEGÍTIMA: esperar um painel sumir depois de uma ação é exatamente
// o uso correto de waitFor negativo (ex.: notification-bell). Separar os dois
// casos mecanicamente exigiria entender a INTENÇÃO do teste.
//
// Uma guarda com 17 exceções é pior que nenhuma: dá impressão de cobertura e
// ninguém revisa a allowlist. Então isto virou regra de revisão documentada no
// CLAUDE.md (#316), não teste — com o achado concreto que a varredura produziu
// já corrigido (goal-line.test.tsx tinha um waitFor vazio desde o #294).
