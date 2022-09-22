export const createPrepopulateEntry = async (fastify, draftOrderId) => {
  const query = await fastify.objection.models.shopifyPrepopulate
    .query()
    .insert({
      draft_order_id: draftOrderId,
      draft_orders: [],
      prepopulate_data: {}
    });
}