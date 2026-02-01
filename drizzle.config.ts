export default {
  dialect: "sqlite",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations/",
  dbCredentials: {
    url: "./drizzle/data/db.sqlite",
  },
};
