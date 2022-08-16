import BaseModel from "./BaseModel.js";

export default class Metrics extends BaseModel {
  static get tableName() {
    return "metrics";
  }

  static get columns() {
    return [
      'id',
      "store_name",
      "store_id",
      "offer_uuid",
      "list_of_redemptions",
      "draft_order_details",
      "asset_id_on_service"
    ];
  }
}
