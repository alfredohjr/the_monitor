"use client";
import { useEffect, useState } from "react";

import { useT } from "@/lib/i18n/useT";
import { ativarPush, desativarPush, permissaoAtual, pushSuportado } from "@/lib/push";

type Estado = "indisponivel" | "desligado" | "ligado" | "negado" | "erro";

/**
 * Botão de ativar/desativar push (#328).
 *
 * A permissão é pedida **no clique**, nunca na montagem. Fora de um gesto do
 * usuário o navegador tende a negar, e "bloqueado" fica gravado para sempre —
 * não existe como reabrir a pergunta por código, só pelas configurações do
 * navegador. Um `requestPermission()` no `useEffect` queimaria a única chance
 * de cada visitante.
 */
export default function PushToggle() {
  const { t } = useT();
  // `null` = ainda não decidido, e não um estado "carregando" nomeado: a
  // ausência de determinação é justamente a ausência de valor. De quebra, evita
  // um literal em useState, que a guarda de i18n vigia por bons motivos.
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    // Só LÊ a permissão; não pede nada.
    if (!pushSuportado()) return setEstado("indisponivel");
    const atual = permissaoAtual();
    if (atual === "denied") return setEstado("negado");
    if (atual === "granted") return setEstado("ligado");
    setEstado("desligado");
  }, []);

  if (estado === null) return null;

  if (estado === "indisponivel") {
    return <p className="text-xs text-zinc-500">{t("pwa.pushUnsupported")}</p>;
  }

  if (estado === "negado") {
    return <p className="text-xs text-amber-500">{t("pwa.pushDenied")}</p>;
  }

  const ligar = async () => {
    const r = await ativarPush();
    if (r === "ok") return setEstado("ligado");
    if (r === "negada") return setEstado("negado");
    if (r === "indisponivel") return setEstado("indisponivel");
    setEstado("erro");
  };

  const desligar = async () => {
    await desativarPush();
    setEstado("desligado");
  };

  const ligado = estado === "ligado";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={ligado ? desligar : ligar}
        className={`self-start px-4 py-2 rounded-full text-sm font-medium transition ${
          ligado
            ? "border border-zinc-300 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {t(ligado ? "pwa.pushDisable" : "pwa.pushEnable")}
      </button>
      {ligado && <p className="text-xs text-zinc-500">{t("pwa.pushEnabled")}</p>}
      {estado === "erro" && <p className="text-xs text-red-400">{t("pwa.pushError")}</p>}
    </div>
  );
}
