import {
  parseAndUpdateUsedByList,
  seedRedeemedByList, seedRedeemedNFtList,
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
  checkUserValidity, updateNftIdRedeem,
  updateV1WalletRedeemedBy, updateWalletAddressRedeem
} from "./shopifyHelpers/shopifyUserRedemptions.js";

dotenv.config({
  path: "../../env",
});

const validateDevToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_DOODLES_SECRET, [ 'H256' ], (err, decoded) => {
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
      condition_types,
      redeem_type
    } = request.body;

    const redeemed_by = seedRedeemedByList(draft_order_details);
    const redeemed_nfts = seedRedeemedNFtList(draft_order_details);

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

      console.log('@@@ post insert query res', query)

      const updateResolve = await updateProductWithTagAndUuid(shopify, query, shop[0]);

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
      console.log('verified', verified)
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
      if (draftOrderRes && draftOrderDetails.hasRedeemLimit) {
        if (draftOrderDetails.typeOfRedeem === 'walletAddress') {
          const updateWalletRes = await updateWalletAddressRedeem(fastify, authSig, offerData[0], draftOrderDetails);
        } else if (draftOrderDetails.typeOfRedeem === 'nftId') {
          const updateNftIdRes = await updateNftIdRedeem(fastify, selectedNft, offerData[0], draftOrderDetails);
        }
      }
      try {
        const draftOrderMetafieldRes = await addShopifyMetafieldToDraftOrder({shopify, draftOrderRes, selectedNft});
      } catch (err) {
        console.log('Error creating draft order metafield', err);
        return err;
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

  fastify.post('/api/shopify/updateDevRedeemedList', async (request, reply) => {
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

  fastify.post('/api/shopify/seed', async (request, reply) => {
    const res = await fastify.objection.models.shopifyDraftOrders.query().insert({
      shopId: '59835023511',
      accessControlConditions: "[{\"conditionType\":\"evmBasic\",\"contractAddress\":\"0xA3D109E28589D2AbC15991B57Ce5ca461Ad8e026\",\"standardContractType\":\"ERC721\",\"chain\":\"polygon\",\"method\":\"balanceOf\",\"parameters\":[\":userAddress\"],\"returnValueTest\":{\"comparator\":\">=\",\"value\":\"1\"}}]",
      humanizedAccessControlConditions: 'Controls wallet with address 0xcC542677e244c83FF66cEd6b6a88Eb7A6da1f024',
      assetIdOnService: 'gid://shopify/Product/7347665535127',
      title: 'check it out - DO NOT DELETE',
      summary: 'Token gated twilight darkness',
      assetType: 'exclusive',
      userId: '',
      draftOrderDetails: '{"id":"gid://shopify/Product/7347665535127","quantity":1,"title":"original discount - DO NOT DELETE","description":null,"redeemLimit":"0","value":0,"valueType":"PERCENTAGE"}',
      extraData: 'evmBasic',
      active: true,
      redeemedBy: '{}',
      description: null,
      discount: null,
      usedChains: null,
      conditionTypes: null,
      redeemedNfts: null,
      assetNameOnService: null,
      offerType: null,
      redeemType: null
    })
    console.log('CHCEK RES!', res)
    return res;
  })
}
