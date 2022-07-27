export const up = (knex) => {
  return knex.schema.createTable("shares", (table) => {
    table.text("extra_data");
  });
};

export const down = (knex) => {
  return knex.schema.table('shares', table => {
    table.dropColumn('redeemed_by');
  })
};
