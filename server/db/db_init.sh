#!/bin/bash
PUSER=postgres
PDB=oauth_lit_db
psql -v ON_ERROR_STOP=1 --username $PUSER --dbname $PDB <<-EOSQL
  BEGIN;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE IF NOT EXISTS sharers (
	  id SERIAL PRIMARY KEY,
	  email VARCHAR(320) NOT NULL UNIQUE,
	  latest_refresh_token CHAR(512) NOT NULL
	);
    CREATE TABLE IF NOT EXISTS links (
	  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	  drive_id CHAR(44) NOT NULL CHECK (CHAR_LENGTH(drive_id) = 44),
	  role INT NOT NULL,
	  requirements JSON NOT NULL,
	  sharer_id INT NOT NULL,
	  CONSTRAINT fk_sharer_id
	      FOREIGN KEY(sharer_id)
	          REFERENCES sharers(id)
	);
  COMMIT;
EOSQL
