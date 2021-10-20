
export const up = (knex) => {
  return knex.schema.createTable('sharers', (table) => {
    table.increments('id');
    table.string('email', 320).unique();
    table.string('latest_refresh_token', 512);
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists('sharers');
};
