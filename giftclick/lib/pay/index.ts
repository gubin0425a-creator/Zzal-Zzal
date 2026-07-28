import { SandboxPayProvider } from "./sandbox";
import { TossPayProvider } from "./toss";
import type { PayProvider } from "./provider";

declare global {
  // eslint-disable-next-line no-var
  var __GC_PAY: PayProvider | undefined;
}

/** PAY_PROVIDER=toss → 토스 실전, 그 외 → 샌드박스(기본) */
export function getPayProvider(): PayProvider {
  if (!globalThis.__GC_PAY) {
    const mode = (process.env.PAY_PROVIDER || "sandbox").toLowerCase();
    globalThis.__GC_PAY = mode === "toss" ? new TossPayProvider() : new SandboxPayProvider();
  }
  return globalThis.__GC_PAY;
}

export { SandboxPayProvider } from "./sandbox";
export { TossPayProvider } from "./toss";
export type { PayProvider } from "./provider";
