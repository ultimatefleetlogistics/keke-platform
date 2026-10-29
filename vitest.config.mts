import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Covers the server side logic this app's money actually flows through:
 * schedule generation, currency/webhook helpers, and the payment/webhook
 * business logic in lib/payments/*.ts (against a mocked Prisma client, see
 * the tests themselves for why). No React component or page testing here,
 * that would need a browser environment (jsdom) and a different kind of
 * setup, this suite is deliberately scoped to the money-sensitive paths
 * requested when this module was built, not full coverage of the app.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
