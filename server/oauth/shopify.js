// import LitJsSdk from "lit-js-sdk";
// import axios from "axios";

export default async function (fastify, opts) {
  fastify.post('/api/shopify/saveDiscount', async (request, reply) => {
    console.log('shopify test')
    const requestData = request

    // const insertToLinksQuery = await fastify.objection.models.shopify_shares
    //   .query()
    //   .insert({
    //     asset_id_on_service: request.body.driveId,
    //     access_control_conditions: JSON.stringify(
    //       request.body.accessControlCondition
    //     ),
    //     connected_service_id: request.body.connectedServiceId,
    //     role: request.body.role,
    //     user_id: request.body.authSig.address,
    //     name: request.body.name,
    //     asset_type: request.body.assetType,
    //     extra_data: request.body.extraData,
    //   });
    //
    // let uuid = await insertToLinksQuery.id;

    return {
      requestData
      // newSavedDiscount: insertToLinksQuery,
      // uuid,
    };
  })

  fastify.post('/api/shopify/deleteDiscount', async (request, reply) => {

    const {address, idOnService} = request.body;
    const shareResponse = await fastify.objection.models.shopify_shares
      .query()
      .delete()
      .where("user_id", "=", address)
      .where('asset_id_on_service', '=', idOnService)

    // const response = await fastify.objection.models.connectedServices
    //   .query()
    //   .delete()
    //   .where("user_id", "=", address)
    //   .where("id_on_service", "=", idOnService);

    return reply;
  });

  fastify.post('/api/shopify/getAllDiscounts', async (request, reply) => {

    const {storeName} = request.body.extraData

    const discounts = await fastify.objection.models.shopify_shares
      .query()
      .where('asset_type', '=', 'discount')
    // .where('user_id', request.body.authSig.address)

    return discounts;
  })

  fastify.post('/api/shopify/deleteAllDiscounts', async (request, reply) => {
    const deleteAllDiscountsResult = await fastify.objection.models.shopify_shares
      .query()
      .delete()
      .where('asset_type', '=', 'discount');

    return deleteAllDiscountsResult;
  })

  fastify.post('/api/shopify/testCondition', async (request, reply) => {
    const requestData = request
    console.log('request connected')

    return requestData;
  })
}
