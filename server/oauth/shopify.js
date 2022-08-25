import {
  parseAndUpdateUsedByList,
  seedRedeemedByList, seedRedeemedNftList,
  shortenShopName
} from "./shopifyHelpers/shopifyReusableFunctions.js";
import Shopify from "shopify-api-node";
import dotenv from "dotenv";
import jsonwebtoken from "jsonwebtoken";
import {
  addShopifyMetafieldToDraftOrder, createNoteAttributesAndTags,
  makeShopifyInstance,
  removeTagAndMetafieldFromProducts,
  updateProductWithTagAndUuid
} from "./shopifyHelpers/shopifyApiNodeHelpers.js";
import LitJsSdk from "lit-js-sdk";
import {
  checkUserValidity, updateMetrics, updateNftIdRedeem,
  updateV1WalletRedeemedBy, updateWalletAddressRedeem
} from "./shopifyHelpers/shopifyUserRedemptions.js";
import { sendSlackMetricsReportMessage } from "../utils.js";

dotenv.config({
  path: "../../env",
});

const validateDevToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET, [ 'H256' ], (err, decoded) => {
      if (err) reject(false);
      else if (decoded) resolve(decoded);
    })
  })
}

export default async function shopifyEndpoints(fastify, opts) {

  fastify.post("/api/shopify/saveAccessToken", async (request, reply) => {
    const {shop, accessToken} = JSON.parse(request.body);
    const shortenedShopName = shortenShopName(shop);
    const queryForExistingShop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_name", "=", shortenedShopName);

    let shopDetails;

    // if shop does not currently exist in our database
    if (!queryForExistingShop.length) {
      console.log('saveAccessToken: shop doesnt yet exist', shop)
      try {
        const shopify = new Shopify({
          shopName: shop,
          accessToken: accessToken,
        });

        shopDetails = await shopify.shop.get([ shop, accessToken ]);

      } catch (err) {
        console.log('----> Error getting shopify details', err)
        reply.code(401);
        return false;
      }

      await fastify.objection.models.shopifyStores.query().insert({
        shop_name: shortenedShopName,
        access_token: accessToken,
        email: shopDetails.email,
        shop_id: shopDetails.id
      });
      await sendSlackMetricsReportMessage({
        msg: `Shopify account connected ${shopDetails.email}`,
      });

    } else {
      console.log('saveAccessToken: shop does exist', shop)
      // shop does exist in database

      try {
        // check to see if token is valid
        const shopify = new Shopify({
          shopName: shop,
          accessToken: accessToken,
        });

        shopDetails = await shopify.shop.get([ shop, accessToken ]);

        // patch shop to update email in case it's changed
        await fastify.objection.models.shopifyStores
          .query()
          .where("shop_name", "=", shortenedShopName)
          .patch({
            email: shopDetails.email,
            access_token: accessToken,
          });
      } catch (err) {
        // if token is invalid, update it with new access token
        console.log('----> Error with Shopify: token is probably invalid', err);
        await fastify.objection.models.shopifyStores
          .query()
          .where("shop_name", "=", shortenedShopName)
          .patch({
            access_token: accessToken,
            email: shopDetails.email,
          });
      }
    }

    const shopInfo = {shopId: shopDetails.id, name: shopDetails.myshopify_domain};
    reply.code(200).send(shopInfo);
  });

  fastify.post("/api/shopify/saveDraftOrder", async (request, reply) => {
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
      condition_types,
      redeem_type
    } = request.body;

    const redeemed_by = seedRedeemedByList(draft_order_details);
    const redeemed_nfts = seedRedeemedNftList(draft_order_details);

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
          condition_types,
          redeem_type
        });

      const updateResolve = await updateProductWithTagAndUuid(shopify, query, shop[0]);

      return query.id;
    } catch (err) {
      console.error("--> Error saving draft order:", err);
      return err;
    }
  });

  fastify.post("/api/shopify/getAllDraftOrders", async (request, reply) => {
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

  fastify.post("/api/shopify/deleteDraftOrder", async (request, reply) => {
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
        detailList: [ 'Unauthorized' ],
        allowRedeem: false,
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
      return {
        err: '',
        detailList: [],
        allowRedeem: true,
      }
    }

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", offerData[0].shopId);

    const updatedRedeemedBy = await updateV1WalletRedeemedBy(fastify, offerData)

    const redemptionStatus = await checkUserValidity(offerData[0], authSig);

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
        allowRedeem: false,
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

    const offerData = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    const draftOrderDetails = JSON.parse(offerData[0].draftOrderDetails);

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", offerData[0].shopId);

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
    const offerData = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    if (offerData[0]) {
      return offerData[0];
    } else {
      return null;
    }
  });

  fastify.post("/api/shopify/redeemOfferAndUpdateUserStats", async (request, reply) => {
    const {uuid, jwt, selectedVariantsArray, selectedNft, authSig} = request.body;
    let verified;
    let payload;
    try {
      const jwtData = LitJsSdk.verifyJwt({jwt});
      verified = jwtData.verified;
      payload = jwtData.payload;
    } catch (err) {

      return {
        err,
        allowRedeem: false,
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

    const offerData = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    const draftOrderDetails = JSON.parse(offerData[0].draftOrderDetails);
    console.log('draftOrderDetails', draftOrderDetails)

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", offerData[0].shopId);

    const shopify = new Shopify({
      shopName: shop[0].shopName,
      accessToken: shop[0].accessToken,
    });

    // Note: check user validity before moving forward and update redeem if they are allowed
    let redeemEntry = {}
    try {
      if (draftOrderDetails.hasRedeemLimit) {
        const validityRes = await checkUserValidity(offerData[0], authSig);
        if (!validityRes.allowRedeem) {
          return validityRes;
        }
        if (draftOrderDetails.typeOfRedeem === 'walletAddress') {
          redeemEntry = await updateWalletAddressRedeem(fastify, authSig, offerData[0], draftOrderDetails);
        } else if (draftOrderDetails.typeOfRedeem === 'nftId') {
          redeemEntry = await updateNftIdRedeem(fastify, selectedNft, offerData[0], draftOrderDetails);
        }
      }
    } catch (err) {
      console.log('Failed to update redemption', err);
      if (draftOrderDetails.hasRedeemLimit) {
        return {
          allowRedeem: false,
          message: 'An error occurred when trying to check redeem limit. Please try again later.'
        }
      }
    }

    const lineItemsArray = selectedVariantsArray.map(v => {
      return {
        title: `${v.productTitle} - ${v.title}`,
        variant_id: v.id,
        id: v.productId,
        price: v.price,
        quantity: 1,
        applied_discount: {
          value_type: draftOrderDetails.valueType.toLowerCase(),
          value: draftOrderDetails.value
        }
      }
    })

    const {tags, note_attributes} = createNoteAttributesAndTags({draftOrderDetails, authSig, selectedNft});

    const draftOrderRequest = {
      note: `Offer Title: ${draftOrderDetails.title}`,
      line_items: lineItemsArray,
      tags,
      note_attributes
    };

    try {
      const draftOrderRes = await shopify.draftOrder.create(draftOrderRequest);
      try {
        const draftOrderMetafieldRes = await addShopifyMetafieldToDraftOrder({shopify, draftOrderRes, selectedNft});
      } catch (err) {
        console.log('Error creating draft order metafield', err);
        return err;
      }

      try {
        updateMetrics(fastify, offerData[0], shop[0].shopName, redeemEntry)
      } catch (err) {
        console.log('Error updating metrics:', err);
      }
      return {redeemUrl: draftOrderRes.invoice_url};
    } catch (err) {
      console.error(`----> Error redeeming draft order for ${shop[0].shopName}`, err);
      return err;
    }
  })

  fastify.post('/api/shopify/getRedeemLimitStats', async (request, reply) => {
    try {
      const result = await validateDevToken(request.headers.authorization);
      if (!result) {
        return "Unauthorized";
      }

      const orderData = await fastify.objection.models.shopifyDraftOrders
        .query()
        .where("id", "=", request.body.id);

      return orderData[0];
    } catch (err) {
      console.error("--> Error getting all draft orders:", err);
      return err;
    }
  })

  fastify.post('/api/shopify/updateRedeemedList', async (request, reply) => {
    console.log('request.body', request.body)
    try {
      const result = await validateDevToken(request.headers.authorization);
      if (!result) {
        return "Unauthorized";
      }

      const {id, typeOfRedeem, redeemedList} = request.body;

      let updatedOrderRes = null;

      if (typeOfRedeem === 'nftId') {
        updatedOrderRes = await fastify.objection.models.shopifyDraftOrders
          .query()
          .where("id", "=", id)
          .patch({
            'redeemed_nfts': redeemedList
          })
      } else if (typeOfRedeem === 'walletAddress') {
        updatedOrderRes = await fastify.objection.models.shopifyDraftOrders
          .query()
          .where("id", "=", id)
          .patch({
            'redeemed_by': redeemedList
          })
      }

      return updatedOrderRes;
    } catch (err) {
      console.error("--> Error getting all draft orders:", err);
      return err;
    }
  })
}
