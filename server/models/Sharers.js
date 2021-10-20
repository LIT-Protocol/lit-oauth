import BaseModel from "./BaseModel.js";

export default class Sharers extends BaseModel {
  static get tableName() {
    return "sharers";
  }

  static get columns() {
    return [
      'id',
      'email',
      'latest_refresh_token'
    ];
  }
}
