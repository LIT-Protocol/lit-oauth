// import LitJsSdk from "lit-js-sdk";
// import axios from "axios";

export default async function (fastify, opts) {
  fastify.post('/api/shopify/saveDiscount', async (request, reply) => {

    const newSavedDiscount = await fastify.objection.models.shopifyShares
      .query()
      .insert({
        asset_id_on_service: request.body.driveId,
        access_control_conditions: JSON.stringify(
          request.body.accessControlCondition
        ),
        connected_service_id: request.body.connectedServiceId,
        role: request.body.role,
        user_id: request.body.authSig.address,
        name: request.body.name,
        asset_type: request.body.assetType,
        extra_data: request.body.extraData,
      });

    return {
      newSavedDiscount: newSavedDiscount,
    };
  })

  fastify.post('/api/shopify/deleteDiscount', async (request, reply) => {

    const {storeId, assetIdOnService} = request.body;

    const shareResponse = await fastify.objection.models.shopifyShares
      .query()
      .delete()
      .where('asset_id_on_service', '=', assetIdOnService)
      .where('store_id', '=', storeId)

    // const response = await fastify.objection.models.connectedServices
    //   .query()
    //   .delete()
    //   .where("user_id", "=", address)
    //   .where("id_on_service", "=", idOnService);

    return reply;
  });

  fastify.post('/api/shopify/getAllDiscounts', async (request, reply) => {

    // const {storeId} = request.body;

    const discounts = await fastify.objection.models.shopifyShares
      .query()
      .where('asset_type', '=', 'discount')
    // .where('store_id', '=', storeId)
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

  fastify.post('/api/shopify/testCondition', async (request, reply) => {
    const requestData = request
    console.log('request connected')

    return true;
  })
}
