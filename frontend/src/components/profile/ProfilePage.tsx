"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import { useLocaleTolerante } from "@/lib/i18n/I18nProvider";
import { LOCALES, type Locale } from "@/lib/i18n";
import { apiFetch, mensagemDeErro } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useT();
  const { locale, setLocale } = useLocaleTolerante();
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  // O idioma do servidor é aplicado UMA vez, na carga. Sem esta trava, qualquer
  // re-execução do efeito reaplica o valor vindo do /me e desfaz a escolha que
  // o usuário acabou de fazer no seletor.
  const localeAplicado = useRef(false);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return router.replace("/login");
    setToken(t);
    apiFetch("/api/v1/me/")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUsername(d.username ?? "");
        setEmail(d.email ?? null);
        setDisplayName(d.display_name ?? "");
        // O servidor é a fonte de verdade do idioma: quem trocou noutro
        // dispositivo não pode voltar ao padrão só por abrir esta tela.
        if (!localeAplicado.current && d.locale && LOCALES.includes(d.locale)) {
          localeAplicado.current = true;
          setLocale(d.locale as Locale);
        }
      })
      .catch(() => {});
  }, [router, setLocale]);

  // Troca de idioma é imediata e independente do "Salvar": persiste no
  // servidor e aplica na hora, sem esperar o formulário do nome.
  const trocarIdioma = async (novo: Locale) => {
    setLocale(novo);
    try {
      await apiFetch("/api/v1/me/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: novo }),
      });
    } catch {
      // Falha de rede não desfaz a escolha local: o próximo /me reconcilia.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setOk(false);
    const nome = displayName.trim();
    if (!nome) {
      setErro(t("profile.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch("/api/v1/me/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: nome }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(mensagemDeErro(d?.detail, t("profile.saveFailed")));
        return;
      }
      setDisplayName(d?.display_name ?? nome);
      setOk(true);
      // Reflete o novo nome no Navbar (que lê de localStorage).
      if (typeof window !== "undefined") localStorage.setItem("username", d?.display_name ?? nome);
    } catch {
      setErro(t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!token) return <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-zinc-50 text-zinc-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="relative z-10 w-full max-w-md bg-white border border-zinc-200 dark:bg-white/[0.03] dark:backdrop-blur-xl dark:border-white/5 p-8 rounded-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">{t("profile.title")}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">{t("profile.subtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="display_name" className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">{t("profile.displayNameLabel")}</label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("profile.displayNamePlaceholder")}
              className="w-full bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="text-sm text-zinc-500 space-y-1">
            {email && <p>{t("profile.emailLabel")} <span className="text-zinc-700 dark:text-zinc-300">{email}</span></p>}
            <p>{t("profile.usernameLabel")} <span className="text-zinc-700 dark:text-zinc-300">{username}</span></p>
          </div>

          <div>
            <label htmlFor="locale" className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">
              {t("profile.languageLabel")}
            </label>
            <select
              id="locale"
              value={locale}
              onChange={(e) => trocarIdioma(e.target.value as Locale)}
              className="w-full bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="en">{t("profile.languageEn")}</option>
              <option value="pt-BR">{t("profile.languagePtBR")}</option>
            </select>
          </div>

          {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
          {ok && <p className="text-sm text-emerald-400">{t("profile.updated")}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition disabled:opacity-50"
          >
            {saving ? t("profile.saving") : t("profile.save")}
          </button>
        </form>
      </div>
    </div>
  );
}
