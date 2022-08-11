import {
  makeShopifyInstance,
  updateProductWithTagAndUuid
} from "./shopifyHelpers/shopifyApiNodeHelpers.js";
import dotenv from "dotenv";
import { shortenShopName } from "./shopifyHelpers/shopifyReusableFunctions.js";

dotenv.config({
  path: "../../env",
});


const updateConditionTypes = (acc) => {
  const unifiedAccessControlConditions = [];
  let chainsUsed = [];
  let conditionTypes = [];
  for (let i = 0; i < acc.length; i++) {
    if (Array.isArray(acc[i])) {
      const updatedConditions = updateConditionTypes(acc[i]);
      unifiedAccessControlConditions.push(updatedConditions);
    } else if (!!acc[i] && !!acc[i]['operator']) {
      unifiedAccessControlConditions.push(acc[i]);
    } else {
      const accHolder = acc[i];
      if (!accHolder['conditionType']) {
        accHolder['conditionType'] = 'evmBasic';
        conditionTypes.push('evmBasic');
      } else {
        conditionTypes.push(...accHolder.conditionType.split(','));
      }

      chainsUsed.push(accHolder.chain);
      unifiedAccessControlConditions.push(accHolder);
    }
  }
  return {
    chainsUsed,
    conditionTypes
  };
}

const getAndUpdateOldOffers = async (fastify, allOffers) => {
  if (!allOffers.length) {
    return [];
  }

  const updatedOldOffers = allOffers.map(o => {
    let offerHolder = JSON.parse(JSON.stringify(o));
    console.log('o', o)

    // update access control conditions
    const parsedAcc = JSON.parse(o.accessControlConditions);
    const updatedUaccObj = updateConditionTypes(parsedAcc);

    // update assetIdOnService
    offerHolder.assetIdOnService = JSON.stringify([ JSON.parse(o.assetIdOnService) ].flat());

    // update conditionTypes.  will always be evmBasic for v1 conditions
    offerHolder.conditionTypes = 'evmBasic';

    // update offerType.  will be same as assetType previously
    offerHolder.offerType = offerHolder.assetType;
    offerHolder.redeemedNfts = {};
    offerHolder.description = offerHolder.description ?? '';

    // update usedChains
    offerHolder['usedChains'] = updatedUaccObj.chainsUsed.join(',');

    const redeemedByHolder = JSON.parse(offerHolder.redeemedBy);
    let updatedRedeemedBy = {};
    updatedUaccObj.conditionTypes.forEach(c => {
      updatedRedeemedBy[c] = redeemedByHolder;
    })
    offerHolder.redeemedBy = JSON.stringify(redeemedByHolder);

    // update draftOrderDetails
    const parsedDraftOrderDetails = JSON.parse(o.draftOrderDetails);
    parsedDraftOrderDetails['conditionTypes'] = updatedUaccObj.conditionTypes.join(',');
    parsedDraftOrderDetails['hasRedeemLimit'] = parsedDraftOrderDetails['redeemLimit'] > 0;
    // parsedDraftOrderDetails['id'] = [ parsedDraftOrderDetails.id ];
    // try {
    //   const checkAssetIdOnService = JSON.parse(parsedDraftOrderDetails.id);
    //   offerHolder.assetIdOnService = parsedDraftOrderDetails.id;
    // } catch (err) {
    //   offerHolder.assetIdOnService = JSON.stringify([ o.assetIdOnService ]);
    // }
    parsedDraftOrderDetails['typeOfAccessControl'] = offerHolder.assetType;
    parsedDraftOrderDetails['typeOfRedeem'] = parsedDraftOrderDetails['redeemLimit'] > 0 ? 'walletAddress' : null;
    parsedDraftOrderDetails['usedChains'] = updatedUaccObj.chainsUsed.join(',');
    offerHolder.draftOrderDetails = JSON.stringify(parsedDraftOrderDetails);

    // update redeemType.  if draftOrder redeem limit is anything above 0, it will be limited by walletAddress
    offerHolder.redeemType = parsedDraftOrderDetails.redeemLimit > 0 ? 'walletAddress' : null;

    //update conditionType
    return offerHolder;
  })

  const shop = await fastify.objection.models.shopifyStores.query()
    .where("shop_id", "=", allOffers[0].shopId);

  const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

  const promisesUpdatedOldOffers = updatedOldOffers.map(async updated => {
    const patched = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', updated.id)
      .patch({
        shop_id: updated.shopId,
        access_control_conditions: updated.accessControlConditions,
        humanized_access_control_conditions: updated.humanizedAccessControlConditions,
        active: updated.active,
        title: updated.title,
        asset_id_on_service: updated.assetIdOnService,
        asset_type: updated.assetType,
        user_id: updated.userId,
        draft_order_details: updated.draftOrderDetails,
        extra_data: updated.extraData,
        used_chains: updated.usedChains,
        description: updated.description,
        discount: updated.discount,
        summary: updated.summary,
        redeemed_by: updated.redeemedBy,
        redeemed_nfts: updated.redeemedNfts,
        asset_name_on_service: updated.assetNameOnService,
        offer_type: updated.offerType,
        condition_types: updated.conditionTypes,
        redeem_type: updated.redeemType
      });
    const parsedDraftOrderDetails = JSON.parse(updated.draftOrderDetails);

    let query = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", updated.id);

    const snakeCaseQuery = {
      id: query[0].id,
      shop_id: query[0].shopId,
      access_control_conditions: query[0].accessControlConditions,
      humanized_access_control_conditions: query[0].humanizedAccessControlConditions,
      asset_id_on_service: query[0].assetIdOnService,
      title: query[0].title,
      summary: query[0].summary,
      asset_type: query[0].assetType,
      user_id: query[0].userId,
      draft_order_details: query[0].draftOrderDetails,
      extra_data: query[0].extraData,
      active: query[0].active,
      redeemed_by: query[0].redeemedBy,
      description: query[0].description,
      discount: query[0].discount,
      used_chains: query[0].usedChains,
      redeemed_nfts: query[0].redeemedNfts,
      condition_types: query[0].conditionTypes,
      asset_name_on_service: query.assetNameOnService,
      offer_type: parsedDraftOrderDetails.typeOfAccessControl,
      redeem_type: query.redeemType
    }

    const updatedMetadataAndTagRes = await updateProductWithTagAndUuid(shopify, snakeCaseQuery, shop[0]);

    return updatedMetadataAndTagRes;
  })

  const resolvedUpdatedOldOffers = await Promise.all(promisesUpdatedOldOffers);

  return resolvedUpdatedOldOffers;
}

export default async function shopifyUpdateConditionsEndpoint(fastify, opts) {
  fastify.post("/api/shopify/updateAllConditions", async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    let shops = [];
    if (request.body['shopId']) {
      shops = await fastify.objection.models.shopifyStores.query().where('shop_id', '=', request.body.shopId);
    } else {
      shops = await fastify.objection.models.shopifyStores.query();
    }

    const allShopsWithDraftOrders = shops.map(async s => {
      let draftOrderHolder = await fastify.objection.models.shopifyDraftOrders.query().where('shop_id', '=', s.shopId);
      return draftOrderHolder;
    })

    const resolvedAllShopsWithDraftOrders = await Promise.all(allShopsWithDraftOrders)
    console.log('resolvedAllShopsWithDraftOrders', resolvedAllShopsWithDraftOrders)
    const iterateThroughShops = resolvedAllShopsWithDraftOrders.map(async s => {
      const updateRes = await getAndUpdateOldOffers(fastify, s);
      return updateRes;
    })

    const resolvedShopIterations = await Promise.all(iterateThroughShops);

    return resolvedShopIterations;
  })

  fastify.post('/api/shopify/getAllMetafields', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    console.log('request.body', typeof request.body)
    const {shopId} = request.body;
    console.log('SHop', shopId)
    const shop = await fastify.objection.models.shopifyStores.query()
      .where("shop_id", "=", shopId);

    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    const allDraftOrders = await fastify.objection.models.shopifyDraftOrders.query().where('shop_id', '=', request.body.shopId)
    let ids = [];
    allDraftOrders.forEach(draftOrder => {
      try {
        const idHolder = JSON.parse(draftOrder.assetIdOnService);
        idHolder.forEach(id => {
          const endHolder = id.split("/").pop();
          console.log('endHolder', endHolder)
          ids.push(endHolder)
        })
      } catch (err) {
        const endHolder = draftOrder.assetIdOnService.split("/").pop();
        ids.push(endHolder)
      }
    })

    // return ids;

    const allProductMetafieldPromises = ids.map(async id => {
      return await shopify.metafield.list({
        metafield: {
          owner_resource: 'product',
          owner_id: id
        }
      })
    })

    const resolvedAllProductMetafields = await Promise.all(allProductMetafieldPromises);

    return resolvedAllProductMetafields.flat();

    // const checkDelete = resolvedAllProductMetafields.flat().map(async meta => {
    //   return await shopify.metafield.delete(meta.id);
    // })
    //
    // const deleteChecked = await Promise.all(checkDelete);
    //
    // return deleteChecked;
  })

  fastify.post('/api/shopify/deleteAllMetafields', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    console.log('request.body', typeof request.body)
    const {shopId} = request.body;
    console.log('SHop', shopId)
    const shop = await fastify.objection.models.shopifyStores.query()
      .where("shop_id", "=", shopId);

    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    const allDraftOrders = await fastify.objection.models.shopifyDraftOrders.query().where('shop_id', '=', request.body.shopId)
    let ids = [];
    allDraftOrders.forEach(draftOrder => {
      try {
        const idHolder = JSON.parse(draftOrder.assetIdOnService);
        console.log('idHolder', idHolder)
        idHolder.forEach(id => {
          const endHolder = id.split("/").pop();
          console.log('endHolder', endHolder)
          ids.push(endHolder)
        })
      } catch (err) {
        const endHolder = draftOrder.assetIdOnService.split("/").pop();
        ids.push(endHolder)
      }
    })

    // return ids;

    const allProductMetafieldPromises = ids.map(async id => {
      return await shopify.metafield.list({
        metafield: {
          owner_resource: 'product',
          owner_id: id
        }
      })
    })

    const resolvedAllProductMetafields = await Promise.all(allProductMetafieldPromises);

    console.log('resolvedAllProductMetafields', resolvedAllProductMetafields)
    // return resolvedAllProductMetafields.flat();
    let filteredMetafields = [];
    resolvedAllProductMetafields.forEach((m, i) => {
      console.log('m', m)
      filteredMetafields[i] = [];
      m.forEach(n => {
        if (n.namespace === 'lit_offer') {
          filteredMetafields[i].push(n)
        }

      })
    })

    const checkDelete = filteredMetafields.flat().map(async meta => {
      return await shopify.metafield.delete(meta.id);
    })

    const deleteChecked = await Promise.all(checkDelete);

    return deleteChecked;
  })

  fastify.post('/api/shopify/getSpecificDraftOrder', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }
    const draftOrder = await fastify.objection.models.shopifyDraftOrders.query().where('id', '=', request.body.id)
    return draftOrder;
  })

  fastify.post('/api/shopify/fixOffers', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    const {entries} = request.body;
    const parsedString = entries.split(',');

    const mappedEntries = parsedString.map(async s => {
      const entry = await fastify.objection.models.shopifyDraftOrders.query().where('id', '=', s);
      return entry;
    })

    const resolvedEntries = await Promise.all(mappedEntries);
    const fixDraftOrders = resolvedEntries.flat().map(async d => {
      // let parsedAssetIdOnService = null;
      const splitAsset = d.assetIdOnService.split('"');
      const redoneArray = [ splitAsset[1] ];
      console.log('redoneArray', redoneArray)
      const stringifiedRedoneArray = JSON.stringify(redoneArray)
      console.log('stringifiedRedoneArray', stringifiedRedoneArray)
      let parsedAssetIdOnService = JSON.parse(d.assetIdOnService);
      // let parsedDraftOrderDetails = JSON.parse(d.draftOrderDetails);
      //
      // if (Array.isArray(parsedDraftOrderDetails.id[0])) {
      //   parsedDraftOrderDetails.id = parsedDraftOrderDetails.id.flat();
      //   // return JSON.stringify(parsedDraftOrderDetails)
      //   const updated = await fastify.objection.models.shopifyDraftOrders.query()
      //     .where('id', '=', d.id)
      //     .patch({
      //       draft_order_details: JSON.stringify(parsedDraftOrderDetails)
      //     })
      //
      //   return updated
      // }
      // return JSON.stringify(parsedDraftOrderDetails)
      // const nestedAssetIdOnService = JSON.parse(parsedAssetIdOnService[0]);
      // console.log('parsedAssetIdOnService', parsedAssetIdOnService)
      // console.log('IS IT AN ARRAY?', Array.isArray(parsedAssetIdOnService))
      // const updated = await fastify.objection.models.shopifyDraftOrders.query()
      //   .where('id', '=', d.id)
      //   .patch({
      //     asset_id_on_service: stringifiedRedoneArray
      //   })
      //
      // return updated
      // return true
    })
    const resolvedFixed = await Promise.all(fixDraftOrders)
    console.log('fix draft orders', resolvedFixed)

    return resolvedFixed;
  })

  fastify.post('/api/shopify/recreateMetadata', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    const {shopId} = request.body;

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", shopId);

    // adds exclusive or discount tag to product
    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    let draftOrders = await fastify.objection.models.shopifyDraftOrders
      .query().where('shop_id', '=', shopId);

    const updatedMetadata = await draftOrders.map(async d => {
      const parsedDraftOrderDetails = JSON.parse(d.draftOrderDetails);
      let camelCaseQuery = d;
      camelCaseQuery['shop_id'] = d.shopId;
      camelCaseQuery['access_control_conditions'] = d.accessControlConditions;
      camelCaseQuery['humanized_access_control_conditions'] = d.humanizedAccessControlConditions;
      camelCaseQuery['asset_id_on_service'] = d.assetIdOnService;
      camelCaseQuery['asset_type'] = d.assetType;
      camelCaseQuery['user_id'] = d.user_id;
      camelCaseQuery['draft_order_details'] = d.draftOrderDetails;
      camelCaseQuery['extra_data'] = d.extraData;
      camelCaseQuery['redeemed_by'] = d.redeemedBy;
      camelCaseQuery['used_chains'] = d.usedChains;
      camelCaseQuery['redeemed_nfts'] = d.redeemedNfts;
      camelCaseQuery['condition_types'] = d.conditionTypes;
      camelCaseQuery['asset_name_on_service'] = d.assetNameOnService;
      camelCaseQuery['offer_type'] = parsedDraftOrderDetails.typeOfAccessControl;
      camelCaseQuery['redeem_type'] = d.redeemType

      return await updateProductWithTagAndUuid(shopify, camelCaseQuery)
    })
    const resolvedUpdatedMetadata = await Promise.all(updatedMetadata);
    return resolvedUpdatedMetadata;
  })

}