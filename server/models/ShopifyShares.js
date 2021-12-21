import BaseModel from "./BaseModel.js";

export default class ShopifyShares extends BaseModel {
  static get tableName() {
    return "shopify_shares";
  }

  static get columns() {
    return [
      'id',
      'store_id',
      'access_control_conditions',
      'humanized_access_control_conditions',
      'asset_id_on_service',
      'title',
      'summary',
      'asset_type',
      'user_id',
      'discount_details',
      'extra_data',
      'active'
    ];
  }
}
