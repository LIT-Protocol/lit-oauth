import {
  shortenShopName
} from "../shopifyHelpers.js";
import Shopify from "shopify-api-node";
import dotenv from "dotenv";
import jsonwebtoken from "jsonwebtoken";

dotenv.config({
  path: "../../env",
});

const validateMetafactoryToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_METAFACTORY_SHOPIFY_SECRET, ['H256'], (err, decoded) => {
      if (err) reject(false);
      else if (decoded) resolve(decoded);
    })
  })
}

export default async function shopifyMetafactoryEndpoints(fastify, opts) {

  // RH ENDPOINTS
  fastify.post("/api/shopify/deleteMetafactoryShopData", async (request, reply) => {
    const result = await validateMetafactoryToken(request.headers.authorization);
    if (!result) {
      reply.code(401).send("Unauthorized");
      return;
    }
    console.log('Webhook to delete shop data')
    // TODO: will need to be expanded and tested to delete shop data upon deleting the app
    reply.code(200).send(true);
  });

  fastify.post(
    "/api/shopify/checkIfMetafactoryProductHasBeenUsed",
    async (request, reply) => {
      try {
        const result = await validateMetafactoryToken(
          request.headers.authorization
        );
        if (!result) {
          return "Unauthorized";
        }
        const gid = request.body.gid;

        const queryForUsedProducts =
          await fastify.objection.models.shopifyDraftOrders
            .query()
            .where("asset_id_on_service", "=", gid);

        return queryForUsedProducts;
      } catch (err) {
        return err;
      }
    }
  );

  fastify.post("/api/shopify/saveMetafactoryDraftOrder", async (request, reply) => {
    try {
      const result = await validateMetafactoryToken(request.headers.authorization);
      if (!result) {
        return "Unauthorized";
      }

      const {
        shop_id,
        shop_name,
        access_control_conditions,
        humanized_access_control_conditions,
        active,
        title,
        asset_id_on_service,
        asset_type,
        user_id,
        draft_order_details,
        extra_data,
        summary,
      } = request.body;

      const getAllShops = await fastify.objection.models.shopifyStores
        .query()

      const shop = await fastify.objection.models.shopifyStores
        .query()
        // .where("shop_id", "=", shop_id);
        .where("shop_name", "=", shortenShopName(shop_name));

      // adds exclusive or discount tag to product
      const shopify = new Shopify({
        shopName: shop[0].shopName,
        accessToken: shop[0].accessToken,
      });

      let id = asset_id_on_service;
      id = id.split("/").pop();

      let product;
      let splitTags;
      try {
        product = await shopify.product.get(id);
        splitTags = product.tags.split(',');
      } catch (err) {
        console.error("--> Error getting product on save DO:", err);
        return err;
      }

      if (asset_type === 'exclusive') {
        splitTags.push('lit-exclusive');
      } else if (asset_type === 'discount') {
        splitTags.push('lit-discount');
      }

      try {
        product = await shopify.product.update(id, { tags: splitTags.join(',') });
      } catch (err) {
        console.error("--> Error updating product on save DO:", err);
        return err;
      }
      // end add exclusive or discount tag to product

      const query = await fastify.objection.models.shopifyDraftOrders
        .query()
        .insert({
          shop_id,
          access_control_conditions,
          humanized_access_control_conditions,
          active,
          title,
          asset_id_on_service,
          asset_type,
          user_id,
          draft_order_details,
          extra_data,
          summary,
        });

      return query.id;
    } catch (err) {
      console.error("--> Error saving draft order:", err);
      return err;
    }
  });

  fastify.post("/api/shopify/getAllMetafactoryDraftOrders", async (request, reply) => {
    try {
      const result = await validateMetafactoryToken(request.headers.authorization);
      if (!result) {
        return "Unauthorized";
      }

      const draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
        .where("shop_id", "=", request.body.shopId);

      return draftOrders;
    } catch (err) {
      console.error("--> Error getting all draft orders:", err);
      return err;
    }
  });

  fastify.post("/api/shopify/deleteMetafactoryDraftOrder", async (request, reply) => {
    const result = await validateMetafactoryToken(request.headers.authorization);

    if (!result) {
      return "Unauthorized";
    }

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", request.body.shopId);

    // deletes exclusive or discount tag from deleted draft order
    const draftToDelete = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.id);

    const shopify = new Shopify({
      shopName: shop[0].shopName,
      accessToken: shop[0].accessToken,
    });

    let id = draftToDelete[0].assetIdOnService;
    id = id.split("/").pop();

    let product;
    let splitTags;
    try {
      product = await shopify.product.get(id);
      splitTags = product.tags.split(',');
    } catch (err) {
      console.error("--> Error getting product on save DO:", err);
      return err;
    }

    try {
      const filteredTags = splitTags.filter(t => (t !== 'lit-discount' && t !== 'lit-exclusive'));
      product = await shopify.product.update(id, { tags: filteredTags.join(',') });
    } catch (err) {
      console.error("--> Error updating product on save DO:", err);
      return err;
    }
    // end delete exclusive or discount tag from deleted draft order

    try {
      const draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
        .delete()
        .where("id", "=", request.body.id);

      return draftOrders;
    } catch (err) {
      console.error("--> Error deleting draft order");
      return "--> Error deleting draft order";
    }
  });

  fastify.post('/api/shopify/testMetafactoryEndpoint', async (request, reply) => {
    console.log('rh point tested')
    return 'Metafactory endpoint successful'
  })
}
