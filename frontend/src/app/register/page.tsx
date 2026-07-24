"use client";
import { API_BASE, mensagemDeErro } from "@/lib/api";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", organizacao: "", codigo: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  // #241: olho para mostrar/ocultar as senhas (o mesmo toggle controla os dois campos).
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_BASE + "/api/v1/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          organizacao: form.organizacao,
          codigo_organizacao: form.codigo,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(mensagemDeErro(data.detail, "Erro ao criar conta"));
      }

      if (form.email) {
        // Cadastro com e-mail exige confirmação antes do primeiro login.
        setSuccess("Conta criada! Enviamos um link de confirmação para o seu e-mail. Verifique antes de entrar.");
      } else {
        router.push("/login");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 relative overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md glass p-10 rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block mb-4">
            <span className="text-2xl font-extrabold tracking-tight text-white mb-2 block">Quantified Self</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Criar Conta</h1>
          <p className="text-zinc-400 text-sm">Preencha os dados para se cadastrar.</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Usuário
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="Ex: alfredo"
            />
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="voce@exemplo.com"
            />
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Organização
            </label>
            <input
              type="text"
              name="organizacao"
              value={form.organizacao}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="Ex: Minha Empresa"
            />
            <p className="text-xs text-zinc-500">
              Se a organização ainda não existe, você a cria e vira o admin. Se já existe, informe o código de acesso para entrar.
            </p>
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Código da organização
            </label>
            <input
              type="text"
              name="codigo"
              value={form.codigo}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="Defina (org nova) ou informe (org existente)"
            />
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full px-5 py-4 pr-12 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 hover:text-zinc-200 transition"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Confirmar Senha
            </label>
            <input
              type={showPassword ? "text" : "password"}
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-300 ${
              loading ? "bg-blue-600/50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5"
            }`}
          >
            {loading ? "Criando conta..." : "Criar Conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Já tem conta?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
