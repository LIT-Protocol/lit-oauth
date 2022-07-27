import { shortenShopName } from "./shopifyHelpers/shopifyReusableFunctions.js";
import Shopify from "shopify-api-node";
import dotenv from "dotenv";
import jsonwebtoken from "jsonwebtoken";
import {
  makeShopifyInstance,
  removeTagAndMetafieldFromProducts,
  updateProductWithTagAndUuid
} from "./shopifyApiNodeHelpers.js";
import LitJsSdk from "lit-js-sdk";
import {
  checkAndUpdateUserRedemption,
  checkUserValidity,
  updateV1WalletRedeemedBy
} from "./shopifyHelpers/shopifyUserRedemptions.js";

dotenv.config({
  path: "../../env",
});

const validateDevToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_AUTH_PLAYGROUND_SHOPIFY_SECRET, [ 'H256' ], (err, decoded) => {
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
      used_chains,
      summary,
      discount,
      description,
      asset_name_on_service,
      offer_type,
      condition_types

    } = request.body;

    const redeemed_by = '{}';
    const redeemed_nfts = '{}';

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
      const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

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
          used_chains,
          description,
          discount,
          summary,
          redeemed_by,
          redeemed_nfts,
          asset_name_on_service,
          offer_type,
          condition_types
        });

      console.log('@@@ post insert query res', query)

      const updateResolve = await updateProductWithTagAndUuid(shopify, request.body, shop[0], query);

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

    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    const deleteProductDataResolve = await removeTagAndMetafieldFromProducts(shopify, draftToDelete[0], shop[0], request.body.id);

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

  fastify.post("/api/shopify/checkForUserValidity", async (request, reply) => {
    console.log('CHECK ON USER VALIDITY YO!', request.body)
    const {uuid, jwt, authSig} = request.body;
    let verified;
    let payload;
    try {
      const jwtData = LitJsSdk.verifyJwt({jwt});
      verified = jwtData.verified;
      payload = jwtData.payload;
    } catch (err) {

      return {
        err,
        allowUserToRedeem: false,
      }
    }

    if (
      !verified ||
      payload.baseUrl !==
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
      payload.path !== "/shopify/l/" + uuid
    ) {
      return "Unauthorized.";
    }

    let offerData = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    const draftOrderDetails = JSON.parse(offerData[0].draftOrderDetails);

    if (!draftOrderDetails.hasRedeemLimit) {
      return true;
    }

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", offerData[0].shopId);

    const updatedRedeemedBy = await updateV1WalletRedeemedBy(fastify, offerData)

    console.log('updatedRedeemedBy', updatedRedeemedBy)

    const redemptionStatus = await checkUserValidity(offerData[0], authSig);

    console.log('after allow redeem', redemptionStatus)
    return redemptionStatus;
  });

  fastify.post("/api/shopify/getAllOfferProducts", async (request, reply) => {
    const {uuid, jwt, authSig} = request.body;
    let verified;
    let payload;
    try {
      const jwtData = LitJsSdk.verifyJwt({jwt});
      verified = jwtData.verified;
      payload = jwtData.payload;
    } catch (err) {

      return {
        err,
        allowUserToRedeem: false,
      }
    }

    if (
      !verified ||
      payload.baseUrl !==
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
      payload.path !== "/shopify/l/" + uuid
    ) {
      return "Unauthorized.";
    }

    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    const draftOrderDetails = JSON.parse(draftOrder[0].draftOrderDetails);

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", draftOrder[0].shopId);

    const shopify = new Shopify({
      shopName: shop[0].shopName,
      accessToken: shop[0].accessToken,
    });

    let errorGettingPromises = null;

    const productsArrayPromises = draftOrderDetails.id.map(async productId => {
      const splitProductId = productId.split("/").pop();

      let productResult;
      try {
        productResult = await shopify.product.get(splitProductId);
      } catch (err) {
        console.log('Error getting product with id', productId, ' - ', err)
        errorGettingPromises = {
          message: 'Error getting products.',
          error: err
        }
      }
      return productResult;
    })

    const productArrayResolved = await Promise.all(productsArrayPromises);

    if (!errorGettingPromises) {
      return productArrayResolved;
    } else {
      return errorGettingPromises;
    }
  });

  fastify.post("/api/shopify/getOffer", async (request, reply) => {
    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);
    console.log('GET OFFER DATA', draftOrder[0])

    if (draftOrder[0]) {
      // const humanizedAccessControlConditions =
      //   draftOrder[0].humanizedAccessControlConditions;
      // const parsedUacc = JSON.parse(draftOrder[0].accessControlConditions);
      // return {parsedUacc, humanizedAccessControlConditions, extraData: draftOrder[0].extraData};
      return draftOrder[0];
    } else {
      return null;
    }
  });

  fastify.post("/api/shopify/redeemOfferAndUpdateUserStats", async (request, reply) => {
    const {uuid, jwt, authSig, variantsForCheckout} = request.body;
    let verified;
    let payload;
    try {
      const jwtData = LitJsSdk.verifyJwt({jwt});
      verified = jwtData.verified;
      payload = jwtData.payload;
    } catch (err) {

      return {
        err,
        allowUserToRedeem: false,
      }
    }

    if (
      !verified ||
      payload.baseUrl !==
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
      payload.path !== "/shopify/l/" + uuid
    ) {
      return "Unauthorized.";
    }

    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    const draftOrderDetails = JSON.parse(draftOrder[0].draftOrderDetails);

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", draftOrder[0].shopId);

    // const shopify = new Shopify({
    //   shopName: shop[0].shopName,
    //   accessToken: shop[0].accessToken,
    // });

    const lineItemsArray = []
    console.log('variantsForCheckout', variantsForCheckout)
    // keep for a rainy day
    // let allowUserToRedeem = checkAndUpdateUserRedemption(offerData[0], authSig);
  })

}
