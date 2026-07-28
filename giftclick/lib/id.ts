export function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function genPinCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `GC-${seg()}-${seg()}`;
}
