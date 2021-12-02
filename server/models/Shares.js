import BaseModel from "./BaseModel.js";

export default class Shares extends BaseModel {
  static get tableName() {
    return "shares";
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
      'extra_data'
    ];
  }
}
