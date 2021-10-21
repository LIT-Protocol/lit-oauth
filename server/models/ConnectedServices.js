import BaseModel from "./BaseModel.js";

export default class ConnectedServices extends BaseModel {
  static get tableName() {
    return "connected_services";
  }

  static get columns() {
    return [
      'id',
      'service_name',
      'access_token',
      'refresh_token',
      'scope',
      'id_on_service',
      'created_at',
      'email',
      'user_id',
      'extra_data',
    ];
  }
}
