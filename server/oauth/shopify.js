import {
  shortenShopName,
  validateMerchantToken,
  parseAndUpdateUsedByList
} from "./shopifyHelpers.js";
import Shopify from "shopify-api-node";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import { sendSlackMetricsReportMessage } from "../utils.js";

dotenv.config({
  path: "../../env",
});

export default async function shopifyEndpoints(fastify, opts) {
  // NEW_SECTION: save auth

  fastify.post("/api/shopify/saveAccessToken", async (request, reply) => {
    const { shop, accessToken, email } = JSON.parse(request.body);
    console.log('saveAccessToken start', request.body)
    const shortenedShopName = shortenShopName(shop);
    const queryForExistingShop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_name", "=", shortenedShopName);


    let typeOfAuth = "newCustomer";
    if (!queryForExistingShop.length) {
      let shopDetails;

      try {
        const shopify = new Shopify({
          shopName: shop,
          accessToken: accessToken,
        });

        shopDetails = await shopify.shop.get([shop, accessToken]);

        console.log('saveAccessToken shopDetails', shopDetails)

      } catch (err) {
        console.log('----> Error getting shopify details', err)
      }

      await fastify.objection.models.shopifyStores.query().insert({
        shop_name: shortenedShopName,
        access_token: accessToken,
        email: email,
        shop_id: shopDetails.id
      });
      await sendSlackMetricsReportMessage({
        msg: `Shopify account connected ${email}`,
      });
    } else {
      console.log('saveAccessToken store exists')
      await fastify.objection.models.shopifyStores
        .query()
        .where("shop_name", "=", shortenedShopName)
        .patch({
          access_token: accessToken,
          email: email,
        });
    }

    reply.code(200);
    return true;
  });

  // NEW_SECTION: required GDPR shopify endpoints

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

  fastify.post("/api/shopify/testEndpoint", async (request, reply) => {
    return "test endpoint successful";
  });

  // NEW_SECTION: merchant calls

  fastify.post(
    "/api/shopify/checkIfProductHasBeenUsed",
    async (request, reply) => {
      try {
        const result = await validateMerchantToken(
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
      summary,
    } = request.body;

    const redeemed_by = '{}';

    try {
      const result = await validateMerchantToken(request.headers.authorization);
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

      let id = asset_id_on_service;
      id = id.split("/").pop();

      let product;
      let splitTags;

      try {
        product = await shopify.product.get(id);
        splitTags = product.tags.split(',');
      } catch (err) {
        console.error("--> Error getting product on save DO:", err);
      }

      if (!!product) {
        if (asset_type === 'exclusive') {
          splitTags.push('lit-exclusive');
        } else if (asset_type === 'discount') {
          splitTags.push('lit-discount');
        }
      }

      try {
        product = await shopify.product.update(id, { tags: splitTags.join(',') });
      } catch (err) {
        console.error("--> Error updating product on save DO:", err);
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
          redeemed_by
        });

      return query.id;
    } catch (err) {
      console.error("--> Error saving draft order:", err);
      return err;
    }
  });

  fastify.post("/api/shopify/getAllDraftOrders", async (request, reply) => {
    try {
      const result = await validateMerchantToken(request.headers.authorization);
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
    const result = await validateMerchantToken(request.headers.authorization);

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

    const shopName = shop[0].shopName;

    const shopify = new Shopify({
      shopName: shopName,
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
      return await fastify.objection.models.shopifyDraftOrders
        .query()
        .delete()
        .where("id", "=", request.body.id);
    } catch (err) {
      console.error("--> Error deleting draft order");
      return "--> Error deleting draft order";
    }
  });

  // NEW_SECTION: Start of customer calls

  fastify.post("/api/shopify/checkForPromotions", async (request, reply) => {
    const shortenedShopName = shortenShopName(request.body.shopName);
    console.log('checkForPromotions request.body', request.body);
    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_name", "=", shortenedShopName);

    console.log('checkForPromotions shop', shop);

    const draftOrders = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("shop_id", "=", shop[0].shopId);

    console.log('checkForPromotions draftOrders', draftOrders);

    const shopName = shop[0].shopName;

    if (draftOrders.length) {
      const filteredDraftOrders = draftOrders.filter((d, i) => {
        return request.body.productGid === d.assetIdOnService;
      });
      return filteredDraftOrders[0].id;
    } else {
      return [];
    }
  });

  fastify.post("/api/shopify/getPromotion", async (request, reply) => {
    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    if (draftOrder[0]) {
      return draftOrder[0];
    } else {
      return null;
    }
  });

  fastify.post("/api/shopify/getAccessControl", async (request, reply) => {
    console.log('getAccessControl - request.body', request.body)
    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", request.body.uuid);

    if (draftOrder[0]) {
      const humanizedAccessControlConditions =
        draftOrder[0].humanizedAccessControlConditions;
      const parsedAcc = JSON.parse(draftOrder[0].accessControlConditions);
      return { parsedAcc, humanizedAccessControlConditions };
    } else {
      return null;
    }
  });

  fastify.post("/api/shopify/setUpDraftOrder", async (request, reply) => {
    const { uuid, jwt } = request.body;
    const { verified, payload } = LitJsSdk.verifyJwt({ jwt });
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

    // if offer has a redeem limit, check that use hasn't exceeded it
    let allowUserToRedeem = true;
    if (!!draftOrder[0].redeemedBy) {
      let redeemedBy = JSON.parse(draftOrder[0].redeemedBy);
      console.log('check redeemedBy', redeemedBy)
      console.log('check payload.sub', payload.sub)

      if (redeemedBy[payload.sub] >= draftOrderDetails.redeemLimit) {
        allowUserToRedeem = false;
      }
    }

    const shopify = new Shopify({
      shopName: shop[0].shopName,
      accessToken: shop[0].accessToken,
    });

    let id = draftOrderDetails.id;
    id = id.split("/").pop();

    let product;
    try {
      product = await shopify.product.get(id);
    } catch (err) {
      console.error("--> Error getting product:", err);
      return err;
    }

    try {
      return { draftOrderDetails, product, allowUserToRedeem };
    } catch (err) {
      console.error("--> Error creating draft order", err);
      return err;
    }
  });

  fastify.post("/api/shopify/redeemDraftOrder", async (request, reply) => {
    const { uuid, selectedProductVariant, jwt } = request.body;
    const { verified, payload } = LitJsSdk.verifyJwt({ jwt });
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

    let id = draftOrderDetails.id;
    id = id.split("/").pop();

    let product;
    try {
      product = await shopify.product.get(id);
    } catch (err) {
      console.error("--> Error getting product:", err);
      return err;
    }

    const draftOrderRequest = {
      note: `Draft order using: ${draftOrderDetails.title}`,
      line_items: [
        {
          title: product.title,
          // note: draftOrderDetails.title,
          variant_id: selectedProductVariant.id,
          id: product.id,
          price: selectedProductVariant.price,
          quantity: 1,
          applied_discount: {
            value_type: draftOrderDetails.valueType.toLowerCase(),
            value: draftOrderDetails.value,
          },
        },
      ],
    };

    try {
      const draftOrderRes = await shopify.draftOrder.create(draftOrderRequest);
      if (draftOrderRes) {
        const updatedUsedByList = parseAndUpdateUsedByList(draftOrder[0].redeemedBy, payload.sub)
        // const updatedUsedByList = 'experiment'
        console.log('updatedUsedByList', updatedUsedByList)
        const updatedDraftOrder = await fastify.objection.models.shopifyDraftOrders
          .query()
          .where("id", "=", request.body.uuid)
          .patch({
            'redeemed_by': updatedUsedByList
          });

        console.log('updatedDraftOrder', updatedDraftOrder)
        return { redeemUrl: draftOrderRes.invoice_url };
      }
    } catch (err) {
      console.error("--> Error redeeming draft order", err);
      return err;
    }
  });

  // TEST ENDPOINTS
  fastify.post("/api/shopify/getProductInformation", async (request, reply) => {
    // const { uuid, jwt } = request.body;
    // const { verified, payload } = LitJsSdk.verifyJwt({ jwt });
    // if (
    //   !verified ||
    //   payload.baseUrl !==
    //   `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
    //   payload.path !== "/shopify/l/" + uuid
    // ) {
    //   return "Unauthorized.";
    // }
    // const draftOrder = await fastify.objection.models.shopifyDraftOrders
    //   .query()
    //   .where("id", "=", request.body.uuid);

    // const draftOrderDetails = JSON.parse(draftOrder[0].draftOrderDetails);

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_name", "=", request.body.shopName);

    const shopify = new Shopify({
      shopName: shop[0].shopName,
      accessToken: shop[0].accessToken,
    });

    let product;
    try {
      product = await shopify.product.get(request.body.productId);
    } catch (err) {
      console.error("--> Error getting product:", err);
      return err;
    }

    try {
      return { product };
    } catch (err) {
      console.error("--> Error returning product info", err);
      return err;
    }
  })
}
