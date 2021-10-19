
export const up = (knex) => {
  return knex.schema.createTable('shares', (table) => {
    table.uuid('id').notNullable();
    table.uuid('connected_service_id').notNullable();
    table.text('access_control_conditions');
    table.text('asset_id_on_service');
    table.text('name');
    table.text('user_id');
    table.text('asset_type');
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists('shares');
};
