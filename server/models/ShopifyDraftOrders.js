import BaseModel from "./BaseModel.js";

export default class ShopifyDraftOrders extends BaseModel {
  static get tableName() {
    return "shopify_draft_orders";
  }

  static get columns() {
    return [
      'id',
      'shop_id',
      'access_control_conditions',
      'humanized_access_control_conditions',
      'asset_id_on_service',
      'title',
      'summary',
      'asset_type',
      'user_id',
      'draft_order_details',
      'extra_data',
      'active',
      'description',
      'discount',
      'used_chains',
      'redeemed_nfts',
      'redeemed_by',
      'asset_name_on_service',
      'offer_type',
      'condition_types'
    ];
  }
}
