export const up = (knex) => {
  return knex.schema.createTable("connected_services", (table) => {
    table.text("extra_data");
  });
};

export const down = (knex) => {
  return knex.schema.table('connected_services', table => {
    table.dropColumn('redeemed_by');
  })
};
