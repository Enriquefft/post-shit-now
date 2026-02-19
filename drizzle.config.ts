import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/core/db/schema.ts",
	out: "./drizzle/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
	},
});
