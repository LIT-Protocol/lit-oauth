export const up = (knex) => {
  return knex.schema.createTable("shopify_draft_orders", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("shop_id").notNullable();
    table.text("access_control_conditions");
    table.text("humanized_access_control_conditions");
    table.text("asset_id_on_service");
    table.text("title");
    table.text("summary");
    table.text("asset_type");
    table.text("user_id");
    table.text('draft_order_details');
    table.text("extra_data");
    table.json("used_by");
    table.boolean('active');
    table.timestamps();
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("shopify_draft_orders");
};
