"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastCtx = createContext<{ push: (message: string, type?: ToastType) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastCtx);
}

const ICONS: Record<ToastType, string> = { success: "✅", error: "💥", info: "💡" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 sm:left-auto sm:right-6 sm:translate-x-0 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`slide-up pointer-events-auto flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md ${
              t.type === "error"
                ? "border-pink/50 bg-pink/15 text-pink"
                : t.type === "success"
                  ? "border-mint/50 bg-mint/15 text-mint"
                  : "border-violet/50 bg-violet/15 text-violet"
            }`}
          >
            <span>{ICONS[t.type]}</span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
