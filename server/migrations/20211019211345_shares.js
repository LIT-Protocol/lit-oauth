export const up = (knex) => {
  return knex.schema.createTable("shares", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("connected_service_id").notNullable();
    table.text("asset_id_on_service");
    table.text("access_control_conditions");
    table.text("name");
    table.text("user_id");
    table.text("asset_type");
    table.text("role");
    table.text("extra_data");
    table.timestamps();
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("shares");
};
