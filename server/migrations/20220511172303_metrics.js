export const up = (knex) => {
  return knex.schema.createTable("metrics", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("store_name")
    table.text("store_id")
    table.text("offer_uuid")
    table.text("list_of_redemptions")
    table.text("draft_order_details")
    table.text("asset_id_on_service")
    table.timestamps();
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("shares");
};
