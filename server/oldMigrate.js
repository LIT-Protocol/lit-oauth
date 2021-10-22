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

  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  await client.query(
    "CREATE TABLE IF NOT EXISTS sharers(id SERIAL PRIMARY KEY, email VARCHAR(320) NOT NULL UNIQUE, latest_refresh_token CHAR(512) NOT NULL)"
  );
  await client.query(
    "CREATE TABLE IF NOT EXISTS links(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), drive_id CHAR(44) NOT NULL CHECK (CHAR_LENGTH(drive_id) = 44), role INT NOT NULL, requirements JSON NOT NULL, sharer_id INT NOT NULL, CONSTRAINT fk_sharer_id FOREIGN KEY(sharer_id) REFERENCES sharers(id))"
  );

  await client.end();
};

main().then(() => console.log("completed"));
