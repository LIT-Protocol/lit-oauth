import BaseModel from "./BaseModel.js";

export default class ShopifyPrepopulate extends BaseModel {
  static get tableName() {
    return "shopify_prepopulate";
  }

  static get columns() {
    return [
      'id',
      'draft_order_id',
      'draft_orders'
    ];
  }
}
