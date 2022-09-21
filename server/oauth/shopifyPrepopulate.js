export default async function shopifyThemeAppExtensionEndpoints(fastify, opts) {
  fastify.post("/api/shopify/createPrePopulatedDraftOrders", async (request, reply) => {
    return true
  });
}