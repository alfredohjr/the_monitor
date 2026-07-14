"use client";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "success" | "error";

export default function VerifyEmail() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Verificando seu e-mail...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Link inválido: token ausente.");
      return;
    }
    fetch(API_BASE + "/api/v1/verify-email/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (r.ok) {
          setStatus("success");
          setMessage("E-mail verificado! Você já pode entrar.");
        } else {
          const data = await r.json().catch(() => ({}));
          setStatus("error");
          setMessage(data.detail ?? "Não foi possível verificar o e-mail.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Não foi possível verificar o e-mail.");
      });
  }, [searchParams]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-md glass p-10 rounded-3xl border border-white/5 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Confirmação de e-mail</h1>
        <p
          className={`text-sm mb-6 ${
            status === "success" ? "text-emerald-400" : status === "error" ? "text-red-400" : "text-zinc-400"
          }`}
        >
          {message}
        </p>
        {status === "success" && (
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-bold transition">
            Ir para o login
          </Link>
        )}
        {status === "error" && (
          <Link href="/register" className="text-blue-400 hover:text-blue-300 transition">
            Voltar ao cadastro
          </Link>
        )}
      </div>
    </div>
  );
}
