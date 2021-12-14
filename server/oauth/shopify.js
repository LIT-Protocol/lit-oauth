export default async function (fastify, opts) {
  fastify.post('/api/shopify/saveDiscount', async (request, reply) => {


    const newSavedDiscount = await fastify.objection.models.shopifyShares
      .query()
      .insert({
        store_id: request.body.store_id,
        asset_id_on_service: request.body.asset_id_on_service,
        access_control_conditions: request.body.access_control_conditions,
        humanized_access_control_conditions: request.body.humanized_access_control_conditions,
        user_id: request.body.user_id,
        title: request.body.title,
        summary: request.body.summary,
        asset_type: request.body.asset_type,
        extra_data: request.body.extra_data
      });

    return {
      newSavedDiscount: newSavedDiscount,
    };
  })

  fastify.post('/api/shopify/deleteDiscount', async (request, reply) => {

    const {store_id, asset_id_on_service} = request.body;

    const shareResponse = await fastify.objection.models.shopifyShares
      .query()
      .delete()
      .where('asset_id_on_service', '=', asset_id_on_service)
      .where('store_id', '=', store_id);

    return shareResponse;
  });

  fastify.post('/api/shopify/getAllDiscounts', async (request, reply) => {

    const discounts = await fastify.objection.models.shopifyShares
      .query()
      .where('store_id', '=', request.body.store_id)
    // .where('user_id', request.body.authSig.address)

    return discounts;
  })

  fastify.post('/api/shopify/getStoreDiscounts', async (request, reply) => {

    const discounts = await fastify.objection.models.shopifyShares
      .query()
      .where('store_id', '=', request.body.store_id)
    // .where('user_id', request.body.authSig.address)

    return discounts;
  })

  fastify.post('/api/shopify/deleteAllDiscounts', async (request, reply) => {
    const deleteAllDiscountsResult = await fastify.objection.models.shopifyShares
      .query()
      .delete()
      .where('asset_type', '=', 'discount');

    return deleteAllDiscountsResult;
  })

  fastify.post('/api/shopify/findDiscount', async (request, reply) => {
    const discounts = await fastify.objection.models.shopifyShares
      .query()
      .where('store_id', '=', request.body.store_id)

    return {
      discounts: discounts,
      message: 'hit the search at least'
    }

  })

  fastify.get('/api/shopify/testEndpoint', async (request, reply) => {
    return 'successful'
  })
}
