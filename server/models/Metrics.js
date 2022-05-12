import BaseModel from "./BaseModel.js";

export default class Metrics extends BaseModel {
  static get tableName() {
    return "metrics";
  }

  static get columns() {
    return [
      'shopify_draft_order_data',
    ];
  }
}
