"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "misto_phone";

/**
 * Persiste o número de WhatsApp do usuário em localStorage durante a sessão.
 * Qualquer tela que precise do telefone pode usar este hook para pré-preencher
 * o campo automaticamente.
 */
export function usePhoneSession() {
  const [phone, setPhoneState] = useState("");

  // Carrega do storage apenas no client (evita hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPhoneState(saved);
    } catch {
      // localStorage indisponível (modo privado restrito, etc.)
    }
  }, []);

  function setPhone(value: string) {
    setPhoneState(value);
    try {
      if (value) {
        localStorage.setItem(STORAGE_KEY, value);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // silencia erros de storage
    }
  }

  return { phone, setPhone };
}
