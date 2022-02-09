# Lit Protocol oauth connectors

## Migrations

To run migrations on heroku, use this crazy
command: `heroku run "cd server; npm i -g knex; knex migrate:latest --esm --knexfile=./knexfile.js --env production"`
