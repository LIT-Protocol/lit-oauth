
export const up = (knex) => {
  return knex.schema.createTable('links', (table) => {
    table.uuid('id')
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.string('drive_id', 44);
    table.integer('role');
    table.json('requirements');
    table.integer('sharer_id');
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists('links');
};
