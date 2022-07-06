import { validateMerchantToken } from "./shopifyHelpers.js";

// NEW_SECTION: required GDPR shopify endpoints
export default async function shopifyGDPREndpoints(fastify, opts) {
  fastify.post("/api/shopify/getCustomerData", async (request, reply) => {
    // will not be needed because we do not store customer data
    if (!request.headers.authorization) {
      reply.code(401).send("Unauthorized");
      return;
    }
    const result = await validateMerchantToken(request.headers.authorization);
    const { shop_domain } = request.body;
    if (!result) {
      reply.code(401).send("Unauthorized");
      return;
    }
    reply.code(200).send(true);
  });

  fastify.post("/api/shopify/deleteCustomerData", async (request, reply) => {
    // will not be needed because we do not store customer data
    if (!request.headers.authorization) {
      reply.code(401).send("Unauthorized");
      return;
    }
    const result = await validateMerchantToken(request.headers.authorization);
    const { shop_domain } = request.body;
    if (!result) {
      reply.code(401).send("Unauthorized");
      return;
    }
    reply.code(200).send(true);
  });

  fastify.post("/api/shopify/deleteShopData", async (request, reply) => {
    if (!request.headers.authorization) {
      reply.code(401).send("Unauthorized");
      return;
    }
    const result = await validateMerchantToken(request.headers.authorization);
    if (!result) {
      reply.code(401).send("Unauthorized");
      return;
    }
    console.log('Webhook to delete shop data')
    // TODO: will need to be expanded and tested to delete shop data upon deleting the app
    reply.code(200).send(true);
  });

}

