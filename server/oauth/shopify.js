import { shortenShopName, validateMerchantToken } from "./shopifyHelpers.js";
import ShopifyToken from 'shopify-token';
import Shopify from "shopify-api-node";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config({
  path: "../../env",
});

const getApiSecret = (name) => {
  if (name === 'lit-protocol') return process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET;
  if (name === 'lit-protocol-shop') return process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET;
}

const getApiKey = (name) => {
  if (name === 'lit-protocol') return process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_API_KEY;
  if (name === 'lit-protocol-shop') return process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_API_KEY;
}

const getScopes = name => {
  if (name === 'lit-protocol') return process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SCOPES;
  if (name === 'lit-protocol-shop') return process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SCOPES;
}

export default async function (fastify, opts) {
  // NEW_SECTION: installation calls

  fastify.get('/api/shopify/newLitPromotionInstallation', async (request, reply) => {
    const { shop } = request.query;
    const shortenedShopName = shortenShopName(shop);
    console.log('ShortenedShopName', shortenedShopName)
    console.log('getApiSecret', getApiSecret(shortenedShopName))
    const shopifyToken = new ShopifyToken({
      sharedSecret: getApiSecret(shortenedShopName),
      // redirectUri: `https://lit-shop.loca.lt/api/shopify/installLitPromotionCallback`,
      redirectUri: `https://oauth-app-dev.litgateway.com/api/shopify/installLitPromotionCallback`,
      apiKey: getApiKey(shortenedShopName)
    });

    // if (!shopifyToken.verifyHmac(request.query)) {
    //   return 'Not Authorized';
    // }

    const nonce = shopifyToken.generateNonce();

    const queryForExistingShop = await fastify.objection.models.shopifyStores.query().where('shop_name', '=', shortenedShopName);

    if (!queryForExistingShop.length) {
      await fastify.objection.models.shopifyStores
        .query()
        .insert({
          shop_name: shortenedShopName,
          nonce: nonce
        });
    } else {
      await fastify.objection.models.shopifyStores
        .query()
        .where('shop_name', '=', shortenedShopName)
        .patch({
          nonce: nonce
        });
    }


    const url = shopifyToken.generateAuthUrl(shop, getScopes[shortenedShopName], nonce);

    console.log('URL', url)

    reply.redirect(url);
  })

  fastify.get('/api/shopify/installLitPromotionCallback', async (request, reply) => {
    const { shop, code, state } = request.query;
    const shortenedShopName = shortenShopName(shop);
    console.log('SHOP PASSED', shop)
    console.log('full query', request.query)

    const nonceQuery = await fastify.objection.models.shopifyStores
      .query()
      .where('shop_name', '=', shortenedShopName);

    // TODO: reintroduce nonce
    // if (!nonceQuery.length || nonceQuery[0].nonce !== state) {
    //   return 'Nonce check failed'
    // }

    const shopifyToken = new ShopifyToken({
      sharedSecret: getApiSecret(shortenedShopName),
      // redirectUri: `https://lit-shop.loca.lt/api/shopify/installLitPromotionCallback`,
      redirectUri: `https://oauth-app-dev.litgateway.com/api/shopify/installLitPromotionCallback`,
      apiKey: getApiKey(shortenedShopName)
    });

    if (!shopifyToken.verifyHmac(request.query)) {
      return 'Not Authorized';
    }

    shopifyToken.getAccessToken(shop, code)
      .then(async (data) => {
        const shopify = new Shopify({
          shopName: shortenedShopName,
          accessToken: data.access_token
        })
        const shopInfo = await shopify.shop.get();

        const query = await fastify.objection.models.shopifyStores
          .query()
          .where('shop_name', '=', shortenedShopName)
          .patch({
            nonce: '',
            access_token: data.access_token,
            email: shopInfo.email,
            shop_id: shopInfo.id,
            shop_name: shortenedShopName
          });

        // reply.redirect(`https://${shortenedShopName}.myshopify.com/admin/apps/${getApiKey(shortenedShopName)}`);
        // reply.redirect(`https://${shortenedShopName}.myshopify.com/admin/apps/lit_protocol_promotional_custom`);
        // axios.get()
        const shopRequestURL = `https://${shop}/admin/api/2020-04/shop.json`;
        const shopRequestHeaders = { 'X-Shopify-Access-Token': data.access_token };
        const shopResponse = await axios.get(shopRequestURL, {
          headers: shopRequestHeaders
        })
        reply.status(200).end(shopResponse);
        // reply.redirect(`https://${shop}/admin/apps`)
      })
      .catch(err => {
        console.log(err)
        return false;
      })
  })

  fastify.get('/api/shopify/getValidShops', async (request, reply) => {

  })

  // NEW_SECTION: required shopify endpoints

  fastify.get('/api/shopify/getCustomerData', async (request, reply) => {

    return 'will return data'
  })

  fastify.get('/api/shopify/deleteCustomerData', async (request, reply) => {

    return 'will delete data'
  })

  fastify.get('/api/shopify/deleteShopData', async (request, reply) => {

    return 'will delete shop data'
  })

  fastify.post('/api/shopify/testEndpoint', async (request, reply) => {
    return 'test endpoint successful'
  })
  //   try {
  //     const result = await validateMerchantToken(request.headers.authorization);
  //     return 'success';
  //   } catch (err) {
  //     console.log('THIS IS AN ERROR', err)
  //     return false;
  //   }
  // const token = request.headers.authorization;
  // const removeBearer = token.split(' ');
  // const splitToken = removeBearer[1];
  // jsonwebtoken.verify(splitToken, getApiSecret(shortenedShopName), ['H256'], (err, decoded) => {
  //   console.log('error', err)
  //   console.log('decoded', decoded)
  // })
  // const authorized = validateMerchantRequest(request.headers.authorization, getApiSecret[shortenedShopName]);

  // NEW_SECTION: merchant calls

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
          asset_type,
          user_id,
          draft_order_details,
          extra_data,
          summary
        });

      return query.id;
    } catch (err) {
      return 'Unauthorized';
    }
  })

  fastify.post('/api/shopify/getAllUserDraftOrders', async (request, reply) => {
    try {
      const result = await validateMerchantToken(request.headers.authorization);
      if (!result) {
        return 'Unauthorized';
      }

      const draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
        .where('shop_id', '=', request.body.shop_id);

      return draftOrders;
    } catch (err) {
      return 'Unauthorized';
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
      return 'Unauthorized';
    }
  })

// NEW_SECTION: Start of customer calls

  fastify.post('/api/shopify/checkForPromotions', async (request, reply) => {
    const shortenedShopName = shortenShopName(request.body.shopName);
    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where('shop_name', '=', shortenedShopName);

    console.log('shop', shop)

    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('shop_id', '=', shop[0].shopId);

    if (draftOrder[0]) {
      return draftOrder[0].id;
    } else {
      return null;
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
      reply.end("JWT verification failed.");
      return;
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

    let sku = draftOrderDetails.sku;
    sku = sku.split('/').pop();
    console.log('SKU', sku)

    let product;
    try {
      product = await shopify.product.get(sku)
      console.log('product res', product)
    } catch (err) {
      console.log('error getting product:', err)
    }

    const draftOrderRequest = {
      note: 'inaugural draft order',
      line_items:
        [{
          title: draftOrderDetails.title,
          sku: sku,
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
      console.log('Draft order res', draftOrderRes)
      if (draftOrderRes) {
        return { redeemUrl: draftOrderRes.invoice_url, product };
      }
    } catch (err) {
      console.log('err.name', err.name)
      console.log('err.code', err.code)
      console.log('err.timings', err.timings)
      return null;
    }
  })


}
