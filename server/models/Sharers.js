import BaseModel from "./BaseModel.js";

export default class Sharers extends BaseModel {
  static get tableName() {
    return "sharers";
  }

  static get columns() {
    return [
      'id',
      'connected_service_id',
      'access_control_conditions',
      'asset_id_on_service',
      'name',
      'user_id',
      'asset_type',
    ];
  }
}
