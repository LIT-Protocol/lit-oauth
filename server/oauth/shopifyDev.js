import { shortenShopName } from "./shopifyHelpers.js";
import Shopify from "shopify-api-node";
import dotenv from "dotenv";
import jsonwebtoken from "jsonwebtoken";

dotenv.config({
  path: "../../env",
});

const validateDevToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_AUTH_PLAYGROUND_SHOPIFY_SECRET, ['H256'], (err, decoded) => {
      if (err) reject(false);
      else if (decoded) resolve(decoded);
    })
  })
}

export default async function shopifyDevEndpoints(fastify, opts) {

  // REFACTOR ENDPOINTS
  fastify.post("/api/shopify/deleteDevShopData", async (request, reply) => {
    const result = await validateDevToken(request.headers.authorization);
    if (!result) {
      reply.code(401).send("Unauthorized");
      return;
    }
    console.log('Webhook to delete shop data')
    // TODO: will need to be expanded and tested to delete shop data upon deleting the app
    reply.code(200).send(true);
  });

  fastify.post("/api/shopify/checkIfDevProductHasBeenUsed", async (request, reply) => {
      try {
        const result = await validateDevToken(
          request.headers.authorization
        );
        if (!result) {
          return "Unauthorized";
        }
        const gid = request.body.gid;

        return await fastify.objection.models.shopifyDraftOrders
          .query()
          .where("asset_id_on_service", "=", gid);
      } catch (err) {
        return err;
      }
    }
  );

  fastify.post("/api/shopify/saveDevDraftOrder", async (request, reply) => {
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

    const redeemed_by = '{}';

    console.log('ITS IDS AND WHATEVER', asset_id_on_service)

    try {
      const result = await validateDevToken(request.headers.authorization);
      if (!result) {
        return "Unauthorized";
      }

      const shop = await fastify.objection.models.shopifyStores
        .query()
        // .where("shop_id", "=", shop_id);
        .where("shop_name", "=", shortenShopName(shop_name));

      // adds exclusive or discount tag to product
      const shopify = new Shopify({
        shopName: shop[0].shopName,
        accessToken: shop[0].accessToken,
      });

      let ids = JSON.parse(asset_id_on_service).map(id => {
        return id.split("/").pop();
      })

      let splitTags;
      let resolvedProducts;

      try {
        const products = await ids.map(async id => {
          return await shopify.product.get(id);
        })
        resolvedProducts = await Promise.all(products);
        console.log('resolvedProducts', resolvedProducts);
        splitTags = resolvedProducts.map(p => {
          return p.tags.split(',');
        });
        console.log('splitTags', splitTags);
      } catch (err) {
        console.error("--> Error getting product on save DO:", err);
      }

      const updatedSplitTags = splitTags.map(s => {
        let updatedTag = s;
        console.log('check split tags', updatedTag)
        if (asset_type === 'exclusive' && updatedTag.indexOf('lit-exclusive') === -1) {
          updatedTag.push('lit-exclusive');
        } else if (asset_type === 'discount' && updatedTag.indexOf('lit-discount') === -1) {
          updatedTag.push('lit-discount');
        }
        return updatedTag;
      });
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
          redeemed_by
        });

      console.log('@@@ post insert query res', query)

      try {
        const updatedProductPromises = resolvedProducts.map(async (p, i) => {
          console.log('UPDATED PRODUCT PROMISES', p)
          return await shopify.product.update(p.id, { tags: updatedSplitTags[i].join(',') });
        })
        const updatedProductsResolved = await Promise.all(updatedProductPromises);
        console.log('UPDATED PRODUCT RESOLVED', updatedProductsResolved)
      } catch (err) {
        console.error("--> Error updating product on save DO:", err);
      };

      return query.id;
    } catch (err) {
      console.error("--> Error saving draft order:", err);
      return err;
    }
  });

  fastify.post("/api/shopify/getAllDevDraftOrders", async (request, reply) => {
    console.log('getAllDevDraftOrders', request.body)
    try {
      const result = await validateDevToken(request.headers.authorization);
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

  fastify.post("/api/shopify/deleteDevDraftOrder", async (request, reply) => {
    const result = await validateDevToken(request.headers.authorization);

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
      console.error("--> Error getting product on delete DO:", err);
    }

    if (!!product) {
      try {
        const filteredTags = splitTags.filter(t => (t !== 'lit-discount' && t !== 'lit-exclusive'));
        product = await shopify.product.update(id, { tags: filteredTags.join(',') });
      } catch (err) {
        console.error("--> Error updating product on delete DO:", err);
      }
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
}
