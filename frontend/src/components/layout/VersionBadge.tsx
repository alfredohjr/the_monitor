import { APP_VERSION } from "@/lib/version";

// Selo de versão global (#221): fica em todas as páginas (montado no layout
// raiz), discreto no rodapé. pointer-events-none para nunca bloquear cliques
// (ex.: o botão flutuante do WhatsApp).
export default function VersionBadge() {
  return (
    <span
      data-testid="version-badge"
      aria-label="Versão do aplicativo"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 pointer-events-none select-none z-40"
    >
      v{APP_VERSION}
    </span>
  );
}
