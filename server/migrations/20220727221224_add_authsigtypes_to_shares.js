export const up = (knex) => {
  return knex.schema.table("shares", (table) => {
    table.boolean("permanent");
    table.text("auth_sig_types");
  });
};

export const down = (knex) => {
  return knex.schema.table('shares', table => {
    table.dropColumn('permanent');
    table.dropColumn('auth_sig_types');
  })
};
