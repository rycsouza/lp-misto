import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type PlatformDb = ReturnType<typeof drizzle<typeof schema>>;

let _platformDb: PlatformDb | null = null;

export function getPlatformDb(): PlatformDb {
  if (_platformDb) return _platformDb;
  const url = process.env.PLATFORM_DATABASE_URL;
  if (!url) throw new Error("PLATFORM_DATABASE_URL is not set");
  _platformDb = drizzle(neon(url), { schema });
  return _platformDb;
}
