import { useState, useEffect } from "react";

export function useSubscribedMetrics(token: string) {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("http://localhost:8000/api/v1/metrics/", { headers }).then(r => r.json()),
      fetch("http://localhost:8000/api/v1/subscriptions/", { headers }).then(r => r.json()),
    ]).then(([mData, sData]) => {
      const all: any[] = Array.isArray(mData) ? mData : mData.results || [];
      const subscribedIds = new Set<number>((Array.isArray(sData) ? sData : []).map((s: any) => s.metric_id));
      setMetrics(all.filter(m => !m.is_default || subscribedIds.has(m.id)));
    }).finally(() => setLoading(false));
  }, [token]);

  return { metrics, loading };
}
