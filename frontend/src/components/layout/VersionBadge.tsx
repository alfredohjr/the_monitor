"use client";
import { APP_VERSION } from "@/lib/version";
import { useT } from "@/lib/i18n/useT";

// Selo de versão global (#221): fica em todas as páginas (montado no layout
// raiz), discreto no rodapé. pointer-events-none para nunca bloquear cliques
// (ex.: o botão flutuante do WhatsApp).
export default function VersionBadge() {
  const { t } = useT();
  return (
    <span
      data-testid="version-badge"
      aria-label={t("layout.appVersion")}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 pointer-events-none select-none z-40"
    >
      v{APP_VERSION}
    </span>
  );
}
