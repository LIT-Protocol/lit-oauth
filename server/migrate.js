import pg from "pg";
const { Client } = pg;

const main = async () => {
  const dbConfig = {
    connectionString: process.env.LIT_PROTOCOL_OAUTH_DB_URL,
  };
  if (process.env.LIT_DEPLOY_ENV === "production") {
    dbConfig.ssl = { rejectUnauthorized: false };
  }
  const client = new Client(dbConfig);
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  await client.query(
    "CREATE TABLE IF NOT EXISTS connected_services (id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(), service_name text, access_token text, refresh_token text, scope text, id_on_service text, email text, created_at timestamp, user_id text, extra_data text);"
  );
  await client.query("create index on connected_services (user_id);");
  await client.query("create index on connected_services (service_name);");

  await client.query(
    "CREATE TABLE IF NOT EXISTS shares (id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(), connected_service_id UUID, access_control_conditions text, asset_id_on_service text, name text, user_id text, asset_type text);"
  );
  await client.query("create index on shares (user_id);");

  await client.end();
};

main().then(() => console.log("completed"));
