// import {
//   shortenShopName,
//   validateMerchantToken,
//   parseAndUpdateUsedByList,
// } from "./shopifyHelpers/shopifyReusableFunctions.js";
// import Shopify from "shopify-api-node";
// import LitJsSdk from "lit-js-sdk";
// import dotenv from "dotenv";
// import { sendSlackMetricsReportMessage } from "../utils.js";
//
// dotenv.config({
//   path: "../../env",
// });
//
// export default async function shopifyEndpoints(fastify, opts) {
//   // NEW_SECTION: save auth
//
//   fastify.post("/api/shopify/saveAccessToken", async (request, reply) => {
//     const {shop, accessToken} = JSON.parse(request.body);
//     const shortenedShopName = shortenShopName(shop);
//     const queryForExistingShop = await fastify.objection.models.shopifyStores
//       .query()
//       .where("shop_name", "=", shortenedShopName);
//
//     let shopDetails;
//
//     // if shop does not currently exist in our database
//     if (!queryForExistingShop.length) {
//       console.log('saveAccessToken: shop doesnt yet exist', shop)
//       try {
//         const shopify = new Shopify({
//           shopName: shop,
//           accessToken: accessToken,
//         });
//
//         shopDetails = await shopify.shop.get([ shop, accessToken ]);
//
//       } catch (err) {
//         console.log('----> Error getting shopify details', err)
//         reply.code(401);
//         return false;
//       }
//
//       await fastify.objection.models.shopifyStores.query().insert({
//         shop_name: shortenedShopName,
//         access_token: accessToken,
//         email: shopDetails.email,
//         shop_id: shopDetails.id
//       });
//       await sendSlackMetricsReportMessage({
//         msg: `Shopify account connected ${shopDetails.email}`,
//       });
//
//     } else {
//       console.log('saveAccessToken: shop does exist', shop)
//       // shop does exist in database
//
//       try {
//         // check to see if token is valid
//         const shopify = new Shopify({
//           shopName: shop,
//           accessToken: accessToken,
//         });
//
//         shopDetails = await shopify.shop.get([ shop, accessToken ]);
//
//         // patch shop to update email in case it's changed
//         await fastify.objection.models.shopifyStores
//           .query()
//           .where("shop_name", "=", shortenedShopName)
//           .patch({
//             email: shopDetails.email,
//             access_token: accessToken,
//           });
//       } catch (err) {
//         // if token is invalid, update it with new access token
//         console.log('saveAccessToken: token is invalid, update', shop)
//         console.log('----> Error with Shopify: token is probably invalid', err);
//         await fastify.objection.models.shopifyStores
//           .query()
//           .where("shop_name", "=", shortenedShopName)
//           .patch({
//             access_token: accessToken,
//             email: shopDetails.email,
//           });
//       }
//     }
//
//     const shopInfo = {shopId: shopDetails.id, name: shopDetails.myshopify_domain};
//     reply.code(200).send(shopInfo);
//   });
//
//   // NEW_SECTION: merchant calls
//
//   fastify.post(
//     "/api/shopify/checkIfProductHasBeenUsed",
//     async (request, reply) => {
//       try {
//         const result = await validateMerchantToken(
//           request.headers.authorization
//         );
//         if (!result) {
//           return "Unauthorized";
//         }
//         const gid = request.body.gid;
//
//         return await fastify.objection.models.shopifyDraftOrders
//           .query()
//           .where("asset_id_on_service", "=", gid);
//       } catch (err) {
//         console.log('----> Error checking if product has been used:', err)
//         return err;
//       }
//     }
//   );
//
//   fastify.post("/api/shopify/saveDraftOrder", async (request, reply) => {
//     const {
//       shop_id,
//       shop_name,
//       access_control_conditions,
//       humanized_access_control_conditions,
//       active,
//       title,
//       asset_id_on_service,
//       asset_type,
//       user_id,
//       draft_order_details,
//       extra_data,
//       summary,
//     } = request.body;
//
//     const redeemed_by = '{}';
//
//     try {
//       const result = await validateMerchantToken(request.headers.authorization);
//       if (!result) {
//         return "Unauthorized";
//       }
//
//       const shop = await fastify.objection.models.shopifyStores
//         .query()
//         // .where("shop_id", "=", shop_id);
//         .where("shop_name", "=", shortenShopName(shop_name));
//
//       console.log('----> Save Draft order retrieved shop', shop)
//
//       // adds exclusive or discount tag to product
//       const shopify = new Shopify({
//         shopName: shop[0].shopName,
//         accessToken: shop[0].accessToken,
//       });
//
//       let id = asset_id_on_service;
//       id = id.split("/").pop();
//
//       let product;
//       let splitTags;
//
//       try {
//         product = await shopify.product.get(id);
//         splitTags = product.tags.split(',');
//       } catch (err) {
//         console.error(`----> Error getting product on save DO for ${shop[0].shopName}:`, err);
//       }
//
//       if (!!product) {
//         if (asset_type === 'exclusive') {
//           splitTags.push('lit-exclusive');
//         } else if (asset_type === 'discount') {
//           splitTags.push('lit-discount');
//         }
//       }
//
//       try {
//         product = await shopify.product.update(id, {tags: splitTags.join(',')});
//       } catch (err) {
//         console.error(`----> Error updating product on save DO for ${shop_name}:`, err);
//         console.log('----> Body for failed save draft order:', request.body);
//       }
//       // end add exclusive or discount tag to product
//
//       const query = await fastify.objection.models.shopifyDraftOrders
//         .query()
//         .insert({
//           shop_id,
//           access_control_conditions,
//           humanized_access_control_conditions,
//           active,
//           title,
//           asset_id_on_service,
//           asset_type,
//           user_id,
//           draft_order_details,
//           extra_data,
//           summary,
//           redeemed_by
//         });
//
//       return query.id;
//     } catch (err) {
//       console.error(`----> Error saving draft order for ${shop_name}:`, err);
//       return err;
//     }
//   });
//
//   fastify.post("/api/shopify/getAllDraftOrders", async (request, reply) => {
//     try {
//       const result = await validateMerchantToken(request.headers.authorization);
//       if (!result) {
//         return "Unauthorized";
//       }
//
//       const draftOrders = await fastify.objection.models.shopifyDraftOrders
//         .query()
//         .where("shop_id", "=", request.body.shopId);
//
//       return draftOrders;
//     } catch (err) {
//       console.error(`----> Error getting all draft orders ${request.body.shopId}:`, err);
//       return err;
//     }
//   });
//
//   fastify.post("/api/shopify/deleteDraftOrder", async (request, reply) => {
//     const result = await validateMerchantToken(request.headers.authorization);
//
//     if (!result) {
//       return "Unauthorized";
//     }
//
//     const shop = await fastify.objection.models.shopifyStores
//       .query()
//       .where("shop_id", "=", request.body.shopId);
//
//     // deletes exclusive or discount tag from deleted draft order
//     const draftToDelete = await fastify.objection.models.shopifyDraftOrders
//       .query()
//       .where("id", "=", request.body.id);
//
//     const shopName = shop[0].shopName;
//
//     const shopify = new Shopify({
//       shopName: shopName,
//       accessToken: shop[0].accessToken,
//     });
//
//     let id = draftToDelete[0].assetIdOnService;
//     id = id.split("/").pop();
//
//     let product;
//     let splitTags;
//     try {
//       product = await shopify.product.get(id);
//       splitTags = product.tags.split(',');
//     } catch (err) {
//       console.error(`----> Error getting product on save DO for ${shopName}:`, err);
//       return err;
//     }
//
//     try {
//       const filteredTags = splitTags.filter(t => (t !== 'lit-discount' && t !== 'lit-exclusive'));
//       product = await shopify.product.update(id, {tags: filteredTags.join(',')});
//     } catch (err) {
//       console.error(`----> Error updating product on save DO for ${shopName}:`, err);
//       return err;
//     }
//     // end delete exclusive or discount tag from deleted draft order
//
//     try {
//       return await fastify.objection.models.shopifyDraftOrders
//         .query()
//         .delete()
//         .where("id", "=", request.body.id);
//     } catch (err) {
//       console.error(`----> Error deleting draft order for ${shopName}:`, err);
//       return "----> Error deleting draft order";
//     }
//   });
//
//   // NEW_SECTION: Start of customer calls
//
//   fastify.post("/api/shopify/getWalletNFTs", async (request, reply) => {
//     console.log('getWalletNFTs address', request.body.authSigs.ethereum.address)
//     console.log('getWalletNFTs unifiedAccessControlConditions', request.body)
//     let NFTResponse = {};
//     // if (request.body?.authSigs?.ethereum) {
//     //   let checkWalletEthNFTsResp;
//     //   checkWalletEthNFTsResp = await checkWalletEthNFTsOnAlchemy(request.body.authSigs.ethereum.address);
//     //   NFTResponse['evmNfts'] = checkWalletEthNFTsResp.data;
//     //   console.log('getWalletNFTs response', checkWalletEthNFTsResp.data)
//     // }
//     console.log('NFTResponse', NFTResponse)
//     // return NFTResponse;
//   });
//
//   fastify.post("/api/shopify/checkForPromotions", async (request, reply) => {
//     const shortenedShopName = shortenShopName(request.body.shopName);
//     console.log('request.body', request.body)
//     const shop = await fastify.objection.models.shopifyStores
//       .query()
//       .where("shop_name", "=", shortenedShopName);
//
//     const draftOrders = await fastify.objection.models.shopifyDraftOrders
//       .query()
//       .where("shop_id", "=", shop[0].shopId);
//
//     const shopName = shop[0].shopName;
//     console.log('--> draft oreders', draftOrders)
//
//     if (draftOrders.length) {
//       const filteredDraftOrders = draftOrders.filter((d, i) => {
//         return request.body.productGid === d.assetIdOnService;
//       });
//       console.log('---> filteredDraftOrders: ', filteredDraftOrders)
//       // return filteredDraftOrders[0]?.id;
//       return draftOrders[1]?.id;
//     } else {
//       return [];
//     }
//   });
//
//   fastify.post("/api/shopify/getPromotion", async (request, reply) => {
//     const draftOrder = await fastify.objection.models.shopifyDraftOrders
//       .query()
//       .where("id", "=", request.body.uuid);
//
//     if (draftOrder[0]) {
//       return draftOrder[0];
//     } else {
//       return null;
//     }
//   });
//
//   fastify.post("/api/shopify/getOffer", async (request, reply) => {
//     const draftOrder = await fastify.objection.models.shopifyDraftOrders
//       .query()
//       .where("id", "=", request.body.uuid);
//     console.log('GET OFFER DATA', draftOrder[0])
//
//     if (draftOrder[0]) {
//       // const humanizedAccessControlConditions =
//       //   draftOrder[0].humanizedAccessControlConditions;
//       // const parsedUacc = JSON.parse(draftOrder[0].accessControlConditions);
//       // return {parsedUacc, humanizedAccessControlConditions, extraData: draftOrder[0].extraData};
//       return draftOrder[0];
//     } else {
//       return null;
//     }
//   });
//
//   fastify.post("/api/shopify/setUpDraftOrder", async (request, reply) => {
//     const {uuid, jwt} = request.body;
//     let verified;
//     let payload;
//     try {
//       const jwtData = LitJsSdk.verifyJwt({jwt});
//       verified = jwtData.verified;
//       payload = jwtData.payload;
//     } catch (err) {
//
//       return {
//         err,
//         allowUserToRedeem: true,
//       }
//     }
//
//     if (
//       !verified ||
//       payload.baseUrl !==
//       `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
//       payload.path !== "/shopify/l/" + uuid
//     ) {
//       return "Unauthorized.";
//     }
//     const draftOrder = await fastify.objection.models.shopifyDraftOrders
//       .query()
//       .where("id", "=", request.body.uuid);
//
//     const draftOrderDetails = JSON.parse(draftOrder[0].draftOrderDetails);
//
//     const shop = await fastify.objection.models.shopifyStores
//       .query()
//       .where("shop_id", "=", draftOrder[0].shopId);
//
//     // TODO: comment in when redeem limit is ready
//     // if offer has a redeem limit, check that use hasn't exceeded it
//     let allowUserToRedeem = true;
//     if (!!draftOrder[0].redeemedBy) {
//       let redeemedBy = JSON.parse(draftOrder[0].redeemedBy);
//       console.log('check redeemedBy', redeemedBy)
//       console.log('check payload.sub', payload.sub)
//
//       if (!!draftOrderDetails.redeemLimit &&
//         draftOrderDetails.redeemLimit > 0 &&
//         redeemedBy[payload.sub] >= draftOrderDetails.redeemLimit) {
//         allowUserToRedeem = false;
//       }
//     }
//
//     const shopify = new Shopify({
//       shopName: shop[0].shopName,
//       accessToken: shop[0].accessToken,
//     });
//
//     console.log('draftOrderDetails', draftOrderDetails)
//
//     // let id = draftOrderDetails.id;
//     let id = draftOrderDetails.id[0];
//     id = id.split("/").pop();
//
//     let product;
//     try {
//       product = await shopify.product.get(id);
//     } catch (err) {
//       console.error(`--> Error getting product: for ${draftOrder[0].shopId}`, err);
//       return err;
//     }
//
//     try {
//       // TODO: comment in when redeem limit is ready
//       return {draftOrderDetails, product, allowUserToRedeem};
//       // return { draftOrderDetails, product };
//     } catch (err) {
//       console.error("----> Error creating draft order", err);
//       return err;
//     }
//   });
//
//   fastify.post("/api/shopify/redeemDraftOrder", async (request, reply) => {
//     const {uuid, selectedProductVariant, jwt, authSigs} = request.body;
//     const {verified, payload} = LitJsSdk.verifyJwt({jwt});
//     if (
//       !verified ||
//       payload.baseUrl !==
//       `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
//       payload.path !== "/shopify/l/" + uuid
//     ) {
//       return "Unauthorized.";
//     }
//     const draftOrder = await fastify.objection.models.shopifyDraftOrders
//       .query()
//       .where("id", "=", request.body.uuid);
//
//     const draftOrderDetails = JSON.parse(draftOrder[0].draftOrderDetails);
//
//     const shop = await fastify.objection.models.shopifyStores
//       .query()
//       .where("shop_id", "=", draftOrder[0].shopId);
//
//     const shopify = new Shopify({
//       shopName: shop[0].shopName,
//       accessToken: shop[0].accessToken,
//     });
//
//     // let id = draftOrderDetails.id;
//     let id = draftOrderDetails.id[0];
//     id = id.split("/").pop();
//
//     let product;
//     try {
//       product = await shopify.product.get(id);
//     } catch (err) {
//       console.error(`----> Error getting product for ${shop[0].shopName}:`, err);
//       return err;
//     }
//
//     const draftOrderRequest = {
//       note: `Draft order using: ${draftOrderDetails.title}`,
//       line_items: [
//         {
//           title: product.title,
//           // note: draftOrderDetails.title,
//           variant_id: selectedProductVariant.id,
//           id: product.id,
//           price: selectedProductVariant.price,
//           quantity: 1,
//           applied_discount: {
//             value_type: draftOrderDetails.valueType.toLowerCase(),
//             value: draftOrderDetails.value,
//           },
//         },
//       ],
//       metafield: {
//         namespace: 'web_3',
//         key: 'gated_wallet_line_items',
//         value: [
//           product.id
//         ]
//       }
//     };
//
//     try {
//       const draftOrderRes = await shopify.draftOrder.create(draftOrderRequest);
//       if (draftOrderRes) {
//         // TODO: comment in when redeem limit is ready
//         const updatedUsedByList = parseAndUpdateUsedByList(draftOrder[0].redeemedBy, payload.sub)
//         // const updatedUsedByList = 'experiment'
//         console.log('updatedUsedByList', updatedUsedByList)
//         const updatedDraftOrder = await fastify.objection.models.shopifyDraftOrders
//           .query()
//           .where("id", "=", request.body.uuid)
//           .patch({
//             'redeemed_by': updatedUsedByList
//           });
//
//         return {redeemUrl: draftOrderRes.invoice_url};
//       }
//     } catch (err) {
//       console.error(`----> Error redeeming draft order for ${shop[0].shopName}`, err);
//       return err;
//     }
//   });
//
//   // TEST ENDPOINTS
//
//   fastify.post("/api/shopify/getProductInformation", async (request, reply) => {
//     if (request.body.key !== process.env.ADMIN_KEY) {
//       return 'nope';
//     }
//     // const { uuid, jwt } = request.body;
//     // const { verified, payload } = LitJsSdk.verifyJwt({ jwt });
//     // if (
//     //   !verified ||
//     //   payload.baseUrl !==
//     //   `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
//     //   payload.path !== "/shopify/l/" + uuid
//     // ) {
//     //   return "Unauthorized.";
//     // }
//     // const draftOrder = await fastify.objection.models.shopifyDraftOrders
//     //   .query()
//     //   .where("id", "=", request.body.uuid);
//
//     // const draftOrderDetails = JSON.parse(draftOrder[0].draftOrderDetails);
//
//     const shop = await fastify.objection.models.shopifyStores
//       .query()
//       .where("shop_name", "=", request.body.shopName);
//
//     const shopify = new Shopify({
//       shopName: shop[0].shopName,
//       accessToken: shop[0].accessToken,
//     });
//
//     let product;
//     try {
//       product = await shopify.product.get(request.body.productId);
//     } catch (err) {
//       console.error(`----> Error getting product for ${shop[0].shopName}:`, err);
//       return err;
//     }
//
//     try {
//       return {product};
//     } catch (err) {
//       console.error(`----> Error returning product info for ${shop[0].shopName}:`, err);
//       return err;
//     }
//   })
//
//   // test endpoints
//   fastify.post("/api/shopify/checkOnDraftOrders", async (request, reply) => {
//     const {name, pass, getEmptyFields, shopId} = request.body;
//
//     if (pass !== process.env.ADMIN_KEY) {
//       return 'nope';
//     }
//
//     let specificStore = null;
//     let draftOrders = null;
//     let allDraftOrders;
//     let allStores = [];
//     if (!!getEmptyFields) {
//       draftOrders = await fastify.objection.models.shopifyDraftOrders
//         .query().where("offer_type", "=", null)
//     } else if (name === 'all') {
//       const allStoresHolder = await fastify.objection.models.shopifyStores
//         .query()
//       draftOrders = await fastify.objection.models.shopifyDraftOrders
//         .query()
//       allStores = allStoresHolder.map(s => {
//         let tempStore = s;
//         delete tempStore.accessToken;
//         return tempStore;
//       })
//     } else if (!!shopId) {
//       specificStore = await fastify.objection.models.shopifyStores
//         .query()
//         .where('shop_id', '=', shopId);
//
//       draftOrders = await fastify.objection.models.shopifyDraftOrders
//         .query()
//         .where("shop_id", "=", specificStore[0].shopId);
//     } else if (!!name) {
//       specificStore = await fastify.objection.models.shopifyStores
//         .query()
//         .where('shop_name', '=', shortenShopName(name));
//
//       draftOrders = await fastify.objection.models.shopifyDraftOrders
//         .query()
//         .where("shop_id", "=", specificStore[0].shopId);
//     }
//
//     return {
//       specificStore: specificStore,
//       storeDraftOrders: draftOrders,
//       allStores: allStores,
//       length: draftOrders.length
//     };
//   });
//
//   fastify.post("/api/shopify/deleteSpecific", async (request, reply) => {
//     if (request.body.key !== process.env.ADMIN_KEY) {
//       return 'nope';
//     }
//
//     const uuid = request.body;
//     const allResults = await fastify.objection.models.shopifyDraftOrders
//       .query()
//       .delete()
//       .where('id', '=', uuid);
//
//     return allResults;
//   })
//
//   fastify.get("/api/shopify/testGetEndpoint", async (request, reply) => {
//     console.log('toggle get testEndpoint');
//
//     return 'get returned';
//   });
//
//   fastify.post("/api/shopify/testEndpoint", async (request, reply) => {
//     console.log('toggle post testEndpoint');
//
//     return 'post returned';
//   });
// }
