export const up = (knex) => {
  return knex.schema.createTable("shopify_shares", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("store_id").notNullable();
    table.text("asset_id_on_service");
    table.text("access_control_conditions");
    table.text("humanized_access_control_conditions");
    table.text("title");
    table.text("summary");
    table.text("asset_type");
    table.text("user_id");
    table.text('discount_details');
    table.text("extra_data");
    table.boolean('active');
    table.timestamps();
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("shopify_shares");
};
