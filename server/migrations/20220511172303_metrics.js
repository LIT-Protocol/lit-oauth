export const up = (knex) => {
  return knex.schema.createTable("metrics", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("shopify_draft_order_data")
    table.timestamps();
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("shares");
};
