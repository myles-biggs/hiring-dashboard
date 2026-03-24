/**
 * Prisma Configuration for Level Hire
 */

import { config } from "dotenv"
import { existsSync } from "fs"
import { resolve } from "path"
import { defineConfig } from "prisma/config"

const envFiles = [".env.local", ".env"]
const envRoots = [process.cwd()]

for (const root of envRoots) {
  for (const file of envFiles) {
    const envPath = resolve(root, file)
    if (existsSync(envPath)) {
      config({ path: envPath })
    }
  }
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required.")
}

export default defineConfig({
  schema: "./prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
})
