export const up = (knex) => {
  return knex.schema.table("shares", (table) => {
    table.string("dao_address").index();
    table.string("source").index();
  });
};

export const down = (knex) => {
  return knex.schema.table("shares", (table) => {
    table.dropColumn("dao_address");
    table.dropColumn("source");
  });
};
