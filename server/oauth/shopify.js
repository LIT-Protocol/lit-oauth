import { shortenProductId, shortenShopName, validateMerchantToken } from "./shopifyHelpers.js";
import Shopify from "shopify-api-node";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";

dotenv.config({
  path: "../../env",
});

export default async function (fastify, opts) {
  // NEW_SECTION: save auth

  fastify.post('/api/shopify/saveAccessToken', async (request, reply) => {
    const { shop, accessToken, email } = request.body;
    const shortenedShopName = shortenShopName(shop);
    const queryForExistingShop = await fastify.objection.models.shopifyStores.query().where('shop_name', '=', shortenedShopName);

    let typeOfAuth = 'newCustomer';
    if (!queryForExistingShop.length) {
      await fastify.objection.models.shopifyStores
        .query()
        .insert({
          shop_name: shortenedShopName,
          access_token: accessToken,
          email: email
        });
    } else {
      typeOfAuth = 'existingCustomer';
      await fastify.objection.models.shopifyStores
        .query()
        .where('shop_name', '=', shortenedShopName)
        .patch({
          access_token: accessToken,
          email: email
        });
    }

    return typeOfAuth;
  })

  // NEW_SECTION: required shopify endpoints

  fastify.post('/api/shopify/getCustomerData', async (request, reply) => {


    return 'will return data'
  })

  fastify.post('/api/shopify/deleteCustomerData', async (request, reply) => {

    return 'will delete data'
  })

  fastify.post('/api/shopify/deleteShopData', async (request, reply) => {
    console.log('DELETE QUERY', request.query)
    const { shop } = request.query;
    const shortenedShopName = shortenShopName(shop);
    // const result = await validateMerchantToken(request.headers.authorization);
    //
    // if (!result) {
    //   return 'Unauthorized';
    // }

    const queryForExistingShop = await fastify.objection.models.shopifyStores.query().where('shop_name', '=', shortenedShopName);

    console.log('Query for existing shops delete', queryForExistingShop)
    return 'will delete shop data'
  })

  fastify.post('/api/shopify/testEndpoint', async (request, reply) => {
    return 'test endpoint successful'
  })

  // NEW_SECTION: merchant calls

  fastify.post('/api/shopify/checkIfProductHasBeenUsed', async (request, reply) => {
    try {
      const result = await validateMerchantToken(request.headers.authorization);
      if (!result) {
        return 'Unauthorized';
      }
      const gid = request.body.gid;

      const queryForUsedProducts = await fastify.objection.models.shopifyDraftOrders.query().where('asset_id_on_service', '=', gid)

      return queryForUsedProducts;
    } catch (err) {
      return err;
    }
  })

  fastify.post('/api/shopify/saveDraftOrder', async (request, reply) => {
    try {
      const result = await validateMerchantToken(request.headers.authorization);
      if (!result) {
        return 'Unauthorized';
      }
      const {
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
        summary
      } = request.body;

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
          summary
        });

      return query.id;
    } catch (err) {
      console.error('--> Error saving draft order:', err);
      return err;
    }
  })

  fastify.post('/api/shopify/getAllUserDraftOrders', async (request, reply) => {
    try {
      console.log('BEFORE GET ALL DRAFT ORDERS', request.body)
      const result = await validateMerchantToken(request.headers.authorization);
      console.log('AFTER CHECK TOKEN', result)
      if (!result) {
        return 'Unauthorized';
      }

      const draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
        .where('shop_id', '=', request.body.shopId);

      return draftOrders;
    } catch (err) {
      console.error('--> Error getting all draft orders:', err)
      return err;
    }
  })

  fastify.post('/api/shopify/deleteDraftOrder', async (request, reply) => {
    try {
      const result = await validateMerchantToken(request.headers.authorization);

      if (!result) {
        return 'Unauthorized';
      }

      const draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
        .delete()
        .where('id', '=', request.body.id);

      return draftOrders;
    } catch (err) {
      console.error('--> Error deleting draft order');
      return '--> Error deleting draft order';
    }
  })

// NEW_SECTION: Start of customer calls

  fastify.post('/api/shopify/checkForPromotions', async (request, reply) => {
    console.log('-->  start check for promotions', request.body)
    const shortenedShopName = shortenShopName(request.body.shopName);
    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where('shop_name', '=', shortenedShopName);

    const draftOrders = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('shop_id', '=', shop[0].shopId);

    if (draftOrders.length) {
      const filteredDraftOrders = draftOrders.filter((d, i) => {
        return request.body.productGid === d.assetIdOnService;
      })
      return filteredDraftOrders[0].id;
    } else {
      return [];
    }
  })

  fastify.post('/api/shopify/getPromotion', async (request, reply) => {
    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', request.body.uuid);

    if (draftOrder[0]) {
      return draftOrder[0];
    } else {
      return null;
    }
  })

  fastify.post('/api/shopify/getAccessControl', async (request, reply) => {
    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', request.body.uuid);


    if (draftOrder[0]) {
      const humanizedAccessControlConditions = draftOrder[0].humanizedAccessControlConditions;
      const parsedAcc = JSON.parse(draftOrder[0].accessControlConditions)
      return { parsedAcc, humanizedAccessControlConditions };
    } else {
      return null;
    }
  })

  fastify.post('/api/shopify/redeemDraftOrder', async (request, reply) => {
    const { uuid, jwt } = request.body;
    const { verified, payload } = LitJsSdk.verifyJwt({ jwt });
    if (
      !verified ||
      payload.baseUrl !==
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
      payload.path !== "/shopify/l/" + uuid
    ) {
      return "JWT verification failed."
    }
    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', request.body.uuid);

    const draftOrderDetails = JSON.parse(draftOrder[0].draftOrderDetails);

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where('shop_id', '=', draftOrder[0].shopId);

    const shopify = new Shopify({
      shopName: shop[0].shopName,
      accessToken: shop[0].accessToken,
    });

    let id = draftOrderDetails.id;
    id = id.split('/').pop();

    let product;
    try {
      product = await shopify.product.get(id)
      console.log('product res', product)
    } catch (err) {
      console.error('--> Error getting product:', err)
      return err;
    }

    const draftOrderRequest = {
      note: `Draft order using: ${draftOrderDetails.title}`,
      line_items:
        [{
          title: product.title,
          // note: draftOrderDetails.title,
          id: product.id,
          price: draftOrderDetails.price,
          quantity: 1,
          applied_discount: {
            value_type: draftOrderDetails.valueType.toLowerCase(),
            value: draftOrderDetails.value,
          }
        }],
    }

    try {
      const draftOrderRes = await shopify.draftOrder.create(draftOrderRequest)
      if (draftOrderRes) {
        return { redeemUrl: draftOrderRes.invoice_url, draftOrderDetails, product };
      }
    } catch (err) {
      console.error('--> Error creating draft order', err);
      return err;
    }
  })


}
