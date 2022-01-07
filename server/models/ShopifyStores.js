import BaseModel from "./BaseModel.js";

export default class ShopifyStores extends BaseModel {
  static get tableName() {
    return "shopify_stores";
  }

  static get columns() {
    return [
      'id',
      'shop_name',
      'shop_id',
      'access_token',
      'nonce',
      'scope',
      'code',
      'email',
      'user_id',
      'extra_data',
    ];
  }
}
