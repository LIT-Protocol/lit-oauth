/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("shopify_prepopulate", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text('draft_order_id')
    table.json('draft_order_data')
    table.timestamps();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTableIfExists("shopify_prepopulate");
};
