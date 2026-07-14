import { useState, useEffect } from "react";
import { apiFetch, API_BASE } from "@/lib/api";

export function useSubscribedMetrics(token: string) {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    // A regra de "quais métricas o usuário acompanha" (próprias + defaults
    // assinadas) vive no backend; aqui só consumimos a lista já filtrada.
    apiFetch(API_BASE + "/api/v1/metrics/?apenas_inscritas=true")
      .then(r => r.json())
      .then(data => setMetrics(Array.isArray(data) ? data : data.results || []))
      .finally(() => setLoading(false));
  }, [token]);

  return { metrics, loading };
}
