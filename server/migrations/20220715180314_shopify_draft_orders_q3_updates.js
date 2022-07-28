export const up = (knex) => {
  return knex.schema.table('shopify_draft_orders', table => {
    table.text('description');
    table.text('discount');
    table.text('used_chains');
    table.text('condition_types');
    table.text('redeemed_nfts');
    table.text('asset_name_on_service');
    table.text('offer_type');
    table.text('redeem_type');
  })
};

export const down = (knex) => {
  return knex.schema.table('shopify_draft_orders', table => {
    table.dropColumn('description');
    table.dropColumn('discount');
    table.dropColumn('used_chains');
    table.dropColumn('condition_types');
    table.dropColumn('redeemed_nfts');
    table.dropColumn('asset_name_on_service');
    table.dropColumn('offer_type');
    table.dropColumn('redeem_type');
  })
};

