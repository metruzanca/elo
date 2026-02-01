import { migrate } from "drizzle-orm/libsql/migrator";
import { resolve } from "path";
import { existsSync, readdirSync } from "fs";
import { db } from "./db";

async function main() {
  const migrationsFolder = resolve(process.cwd(), "drizzle", "migrations");
  console.log("Running migrations...");
  console.log("Migrations folder:", migrationsFolder);
  console.log("Migrations folder exists:", existsSync(migrationsFolder));
  if (existsSync(migrationsFolder)) {
    console.log("Migrations:", readdirSync(migrationsFolder));
  }

  await migrate(db, { migrationsFolder });
  console.log("Migrations complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
