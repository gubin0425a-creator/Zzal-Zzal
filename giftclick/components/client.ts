"use client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: string }).error || "요청 처리 중 오류가 발생했어요.",
      res.status,
    );
  }
  return json as T;
}

export const fetcher = <T = unknown,>(url: string): Promise<T> => api<T>(url);
