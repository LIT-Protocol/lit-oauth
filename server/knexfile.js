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
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  },
};

// // Update with your config settings.
//
// module.exports = {
//   development: {
//     client: "pg",
//     connection: {
//       connection: process.env.LIT_PROTOCOL_OAUTH_DB_URL,
//       user: process.env.LIT_PROTOCOL_OAUTH_DB_USER,
//       password: null
//     },
//     migrations: {
//       tableName: "knex_migrations",
//     },
//   },
//
//   staging: {
//     client: "pg",
//     connection: {
//       connection: process.env.LIT_PROTOCOL_OAUTH_DB_URL,
//       user: process.env.LIT_PROTOCOL_OAUTH_DB_USER,
//       password: null
//     },
//     pool: {
//       min: 2,
//       max: 10,
//     },
//     migrations: {
//       tableName: "knex_migrations",
//     },
//   },
//
//   production: {
//     client: "pg",
//     connection: {
//       connection: process.env.LIT_PROTOCOL_OAUTH_DB_URL,
//       user: process.env.LIT_PROTOCOL_OAUTH_DB_USER,
//       password: null
//     },
//     pool: {
//       min: 2,
//       max: 10,
//     },
//     migrations: {
//       tableName: "knex_migrations",
//     },
//   },
// };
