export const up = (knex) => {
  return knex.schema.table('shopify_draft_orders', table => {
    table.text('redeemed_by');
  })
};

export const down = (knex) => {
  return knex.schema.table('shopify_draft_orders', table => {
    table.dropColumn('redeemed_by');
  })
};
