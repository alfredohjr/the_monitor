"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
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
      const response = await fetch("http://localhost:8000/api/v1/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail ?? "Erro ao criar conta");
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
              Senha
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Confirmar Senha
            </label>
            <input
              type="password"
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
