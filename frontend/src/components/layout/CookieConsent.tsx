"use client";
import React, { useEffect, useState } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie-consent")) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl glass border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-2xl">
        <p className="text-sm text-zinc-300 flex-1">
          Usamos cookies para manter você logado e melhorar sua experiência. Ao continuar, você concorda com o uso de cookies.
        </p>
        <button
          onClick={accept}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-medium text-sm text-white whitespace-nowrap transition"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
