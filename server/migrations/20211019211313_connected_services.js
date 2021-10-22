export const up = (knex) => {
  return knex.schema.createTable("connected_services", (table) => {
    table
      .uuid("id")
      .unique()
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("service_name");
    table.text("access_token");
    table.text("refresh_token");
    table.text("scope");
    table.text("id_on_service");
    table.text("email");
    table.text("user_id");
    table.text("extra_data");
    table.timestamps();
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("connected_services");
};
