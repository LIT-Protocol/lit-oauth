import BaseModel from "./BaseModel.js";

export default class Links extends BaseModel {
  static get tableName() {
    return "links";
  }

  static get columns() {
    return [
      'id',
      'drive_id',
      'role',
      'requirements',
      'sharer_id'
    ];
  }
}
