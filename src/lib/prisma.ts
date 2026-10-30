import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: ["error"],
  });

// Always cache client on globalThis across all environments (including production)
// to prevent exhausting connection pools across serverless lambdas and warm containers!
globalThis.prismaGlobal = prisma;

export default prisma;
