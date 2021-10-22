// Update with your config settings.

import dotenv from "dotenv";

dotenv.config({
  path: "../.env",
});

export default {
  development: {
    client: "pg",
    connection: process.env.LIT_PROTOCOL_OAUTH_DB_URL,
    migrations: {
      tableName: "knex_migrations",
    },
  },

  production: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 0,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
    },
    debug: true,
  },
};
