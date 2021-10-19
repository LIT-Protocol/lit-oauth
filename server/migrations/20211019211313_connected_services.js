
export const up = (knex) => {
  return knex.schema.createTable('connected_services', (table) => {
    table.uuid('id').notNullable();
    table.text('service_name');
    table.text('access_token');
    table.text('refresh_token');
    table.text('scope');
    table.text('id_on_service');
    table.timestamp('created_at');
    table.text('email');
    table.text('user_id');
    table.text('extra_data');
  })
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists('connected_services');
};
