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
import { createPrepopulateEntry, toggleRecursiveCalls } from "./shopifyHelpers/shopifyPrepopulateFunctions.js";

dotenv.config({
  path: "../../env",
});

const validateDevToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    // jsonwebtoken.verify(splitToken, process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET, [ 'H256' ], (err, decoded) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_PROTOCOL_SHOP_ZAPPOS_SECRET, [ 'H256' ], (err, decoded) => {
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
      redeem_type,
      allow_prepopulate,
      prepopulate_data,
      product_details
    } = request.body;

    console.log('@@@@@@ -> saveDraftOrder request.body', request.body)

    const redeemed_by = seedRedeemedByList(draft_order_details);
    const redeemed_nfts = seedRedeemedNftList(draft_order_details);

    console.log('@@@@@@ -> saveDraftOrder after seedRedeemedBy')

    try {
      const result = await validateDevToken(request.headers.authorization);
      if (!result) {
        return "Unauthorized";
      }

      const shop = await fastify.objection.models.shopifyStores
        .query()
        // .where("shop_id", "=", shop_id);
        .where("shop_name", "=", shortenShopName(shop_name));

      console.log('@@@@@@ -> saveDraftOrder check shop', shop)

      // adds exclusive or discount tag to product
      const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

      console.log('@@@@@@ -> saveDraftOrder shopify instance')

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
          redeem_type,
        });

      console.log('@@@@@@ -> saveDraftOrder after insert draft order')

      const updateResolve = await updateProductWithTagAndUuid(shopify, query, shop[0]);

      // Note: sets up prepopulate
      if (allow_prepopulate) {
        const prepopulateDataRes = await createPrepopulateEntry({
          fastify,
          productDetails: product_details,
          draftOrderId: query.id,
          prepopulateData: prepopulate_data,
          // shopify,
          // shop: shop[0],
          // draftOrderDetails: draft_order_details,
        });
        const parsedDraftOrderDetails = JSON.parse(draft_order_details);
        console.log('SHOPIFY.com parsedDraftOrderDetails', parsedDraftOrderDetails)
        toggleRecursiveCalls({
          fastify,
          shopify,
          offerId: query.id,
          parsedDraftOrderDetails
        });
      }

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

    const parsedDraftOrderDetails = JSON.parse(draftToDelete[0].draftOrderDetails);
    console.log('parsedDraftOrderDetails', parsedDraftOrderDetails)
    console.log('draftToDelete', draftToDelete[0])
    try {
      if (!!parsedDraftOrderDetails.allowPrepopulate) {
        const deletedPrepopulate = await fastify.objection.models.shopifyPrepopulate
          .query()
          .delete()
          .where("draft_order_id", "=", draftToDelete[0].id);

        console.log('DELETE PREPOPULATED', deletedPrepopulate)
      }
    } catch (err) {
      console.log('Error deleting prepopulate', err)
    }

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
    // const {uuid, jwt, selectedVariantsArray, selectedNft, authSig} = request.body;
    // let verified;
    // let payload;
    // try {
    //   const jwtData = LitJsSdk.verifyJwt({jwt});
    //   verified = jwtData.verified;
    //   payload = jwtData.payload;
    // } catch (err) {
    //
    //   return {
    //     err,
    //     allowRedeem: false,
    //   }
    // }

    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

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

    const parsedDraftOrderDetails = JSON.parse(offerData[0].draftOrderDetails);

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
      if (parsedDraftOrderDetails.hasRedeemLimit) {
        const validityRes = await checkUserValidity(offerData[0], authSig);
        if (!validityRes.allowRedeem) {
          return validityRes;
        }
        if (parsedDraftOrderDetails.typeOfRedeem === 'walletAddress') {
          redeemEntry = await updateWalletAddressRedeem(fastify, authSig, offerData[0], parsedDraftOrderDetails);
        } else if (parsedDraftOrderDetails.typeOfRedeem === 'nftId') {
          redeemEntry = await updateNftIdRedeem(fastify, selectedNft, offerData[0], parsedDraftOrderDetails);
        }
      }
    } catch (err) {
      console.log('Failed to update redemption', err);
      if (parsedDraftOrderDetails.hasRedeemLimit) {
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
          value_type: parsedDraftOrderDetails.valueType.toLowerCase(),
          value: parsedDraftOrderDetails.value
        }
      }
    })

    const {tags, note_attributes} = createNoteAttributesAndTags({parsedDraftOrderDetails, authSig, selectedNft});

    const draftOrderRequest = {
      note: `Offer Title: ${parsedDraftOrderDetails.title}`,
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

  fastify.post('/api/shopify/checkOnPrepopulateStatus', async (request, reply) => {
    const result = await validateDevToken(request.headers.authorization);
    if (!result) {
      return "Unauthorized";
    }

    const {offerId} = request.body;

    const draftOrderPrepopulateObj = await fastify.objection.models.shopifyPrepopulate
      .query()
      .where('draft_order_id', '=', offerId);

    let statusObject = {
      status: 'complete',
      individualStatus: [],
      time: null
    };

    let mappedStatus = []
    Object.keys(draftOrderPrepopulateObj[0].prepopulateData).forEach(v => {
      const variantObj = draftOrderPrepopulateObj[0].prepopulateData[v];

      // set overall status
      if (variantObj.status !== 'complete' && statusObject.status !== 'error') {
        statusObject.status = 'incomplete';
      }
      if (variantObj.status === 'error') {
        statusObject.status = 'error';
      }

      // get variant display name
      const variantInfo = draftOrderPrepopulateObj[0].productDetails[0].variants.find(w => {
        return w.id.split("/").pop() === v;
      });

      // get number of used draft orders
      let used = 0;
      variantObj.draftOrderUrls.forEach(draftOrder => {
        if (draftOrder.used) {
          used++;
        }
      })

      mappedStatus.push({
        variantStatus: variantObj.status,
        length: variantObj.numberOfOrders,
        used,
        errors: draftOrderPrepopulateObj[0].errors,
        displayName: variantInfo.displayName
      });
    });

    statusObject.individualStatus = mappedStatus;
    statusObject.time = Date.now();

    return statusObject;
  })

  fastify.post('/api/shopify/getPrepopulateInfo', async (request, reply) => {
    const {uuid, jwt} = request.body;
    console.log('getPrepopulateInfo request.body', request.body)
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

    const draftOrderPrepopulateObj = await fastify.objection.models.shopifyPrepopulate
      .query()
      .where('draft_order_id', '=', uuid);

    let statusObject = {
      individualStatus: [],
      time: null
    };

    let mappedStatus = []
    Object.keys(draftOrderPrepopulateObj[0].prepopulateData).forEach(v => {
      const variantObj = draftOrderPrepopulateObj[0].prepopulateData[v];

      // get variant display name
      const variantInfo = draftOrderPrepopulateObj[0].productDetails[0].variants.find(w => {
        return w.id.split("/").pop() === v;
      });

      console.log('variantInfo', variantInfo)
      // get number of used draft orders
      let used = 0;
      let available = true;
      variantObj.draftOrderUrls.forEach(draftOrder => {
        if (draftOrder.used) {
          used++;
        }
      })

      // set can redeem based on number of draft order already used vs number of existing
      if (used === variantObj.draftOrderUrls.length) {
        available = false;
      }

      mappedStatus.push({
        variantId: variantInfo.id,
        productId: variantInfo.product.id,
        length: variantObj.numberOfOrders,
        available,
        displayName: variantInfo.displayName,
        title: variantInfo.title
      });
    });

    statusObject.individualStatus = mappedStatus;
    statusObject.time = Date.now();

    return statusObject;
  })

  fastify.post('/api/shopify/redeemPrepopulate', async (request, reply) => {
    const {draftOrderId, jwt, selectedVariantsArray, selectedNft, authSig} = request.body;
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
      payload.path !== "/shopify/l/" + draftOrderId
    ) {
      return "Unauthorized.";
    }

    const offerData = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.draftOrderId);

    const parsedDraftOrderDetails = JSON.parse(offerData[0].draftOrderDetails);
    console.log('draftOrderDetails', parsedDraftOrderDetails)

    const prepopulateData = await fastify.objection.models.shopifyPrepopulate
      .query()
      .where("draft_order_id", "=", request.body.draftOrderId);

    // find unused link
    const selectedVariantId = selectedVariantsArray[0].id;
    const foundCouponIndex = prepopulateData[0].prepopulateData[selectedVariantId].draftOrderUrls.findIndex((v, i) => !v.used)
    // switch link to used
    prepopulateData[0].prepopulateData[selectedVariantId].draftOrderUrls[foundCouponIndex].used = true;

    // patch data with updated list
    await fastify.objection.models.shopifyPrepopulate
      .query()
      .where("draft_order_id", "=", request.body.draftOrderId)
      .patch({
        prepopulateData: JSON.stringify(prepopulateData[0].prepopulateData)
      });

    return prepopulateData[0].prepopulateData[selectedVariantId].draftOrderUrls[foundCouponIndex];

    // const shop = await fastify.objection.models.shopifyStores
    //   .query()
    //   .where("shop_id", "=", offerData[0].shopId);
    //
    // const shopify = new Shopify({
    //   shopName: shop[0].shopName,
    //   accessToken: shop[0].accessToken,
    // });


  })
}
