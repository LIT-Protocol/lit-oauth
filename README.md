⛔️ DEPRECATED this is an unmaintained repository using an older version of the Lit JS SDK. 

# Lit Protocol oauth connectors

## Migrations

To run migrations on heroku, you can try this this crazy
command: `heroku run "cd server; npm i -g knex; knex migrate:latest --esm --knexfile ./knexfile.js --env production"`

If that doesn't work, then just try this: `heroku run "cd server; npm i -g knex; knex migrate:latest"`

And if that doesn't work, then you should use migrate:up instead of migrate:latest and do them one at a tiem.
