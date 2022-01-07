export const up = (knex) => {
  return knex.schema.createTable("shopify_stores", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("shop_name");
    table.text("shop_id");
    table.text("access_token");
    table.text("nonce");
    table.text("scope");
    table.text("code");
    table.text("email");
    table.text("user_id");
    table.text("extra_data");
    table.timestamps();
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("shopify_stores");
};
