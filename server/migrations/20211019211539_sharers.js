
export const up = (knex) => {
  return knex.schema.createTable('sharers', (table) => {
    table.increments('id');
    table.string('email', 320);
    table.string('latest_refresh_token', 512);
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists('sharers');
};
