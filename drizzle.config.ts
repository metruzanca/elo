import { dirname, resolve } from "path";
import { existsSync, mkdirSync } from "fs";

// Ensure the data directory exists before drizzle-kit tries to access it
const dbPath = resolve(process.cwd(), "drizzle", "data", "db.sqlite");
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

export default {
  dialect: "sqlite",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations/",
  dbCredentials: {
    url: dbPath,
  },
};
