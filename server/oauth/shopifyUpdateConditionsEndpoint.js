import {
  makeShopifyInstance,
  updateProductWithTagAndUuid
} from "./shopifyHelpers/shopifyApiNodeHelpers.js";
import dotenv from "dotenv";
import { shortenShopName } from "./shopifyHelpers/shopifyReusableFunctions.js";
import axios from "axios";

dotenv.config({
  path: "../../env",
});

function delay(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

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
    try {
      const parsedAssetId = JSON.parse(o.assetIdOnService);
      if (!Array.isArray(parsedAssetId)) {
        offerHolder.assetIdOnService = JSON.stringify([ parsedAssetId ].flat());
      } else {
        offerHolder.assetIdOnService = JSON.stringify(parsedAssetId.flat());
      }
    } catch (err) {
      offerHolder.assetIdOnService = JSON.stringify([ o.assetIdOnService ]);
    }

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
    if (!Array.isArray(parsedDraftOrderDetails.id)) {
      parsedDraftOrderDetails['id'] = [ parsedDraftOrderDetails.id ];
    }
    parsedDraftOrderDetails['conditionTypes'] = updatedUaccObj.conditionTypes.join(',');
    parsedDraftOrderDetails['typeOfAccessControl'] = offerHolder.assetType;
    parsedDraftOrderDetails['usedChains'] = updatedUaccObj.chainsUsed.join(',');
    offerHolder.draftOrderDetails = JSON.stringify(parsedDraftOrderDetails);

    // update redeemType.  if draftOrder redeem limit is anything above 0, it will be limited by walletAddress
    // parsedDraftOrderDetails['hasRedeemLimit'] = parsedDraftOrderDetails['redeemLimit'] > 0;
    // parsedDraftOrderDetails['typeOfRedeem'] = parsedDraftOrderDetails['redeemLimit'] > 0 ? 'walletAddress' : null;
    // offerHolder.redeemType = parsedDraftOrderDetails.redeemLimit > 0 ? 'walletAddress' : null;

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

const recursiveUpdateAccessToken = async (arrayOfShops, fastify) => {
  if (!arrayOfShops.length) {
    return;
  }
  let currentArrayOfShops = arrayOfShops;

  const store = currentArrayOfShops.shift();

  console.log('----> recursive store', store)

  const oldAccessToken = store.accessToken;

  const postData = {
    client_id: process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_API_KEY,
    client_secret: process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET,
    refresh_token: process.env.SHOPIFY_TEMP_REFRESH_TOKEN,
    access_token: oldAccessToken,
  }

  try {
    const response = await axios.post(`https://${store.shopName}.myshopify.com/admin/oauth/access_token.json`, postData);

    const newAccessToken = response["access_token"]

    console.log('CHECK DATA ON UPDATE', response)
    console.log('CHECK ACCESS TOKEN', newAccessToken)
    const updatedStore = await fastify.objection.models.shopifyStores.query()
      .where('shop_name', '=', store.shopName)
      .patch({
        access_token: newAccessToken
      })
    console.log('updatedStore', updatedStore)
  } catch (err) {
    console.log('unable to update', err)
  }

  setTimeout(async () => {
    await recursiveUpdateAccessToken(currentArrayOfShops, fastify)
  }, 1000)
}

export default async function shopifyUpdateConditionsEndpoint(fastify, opts) {
  fastify.post("/api/shopify/patchOffer", async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    const {id, offerUpdate} = request.body;

    if (!id || !offerUpdate) {
      return 'incomplete information'
    }

    const draftOrderPatch = fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', id)
      .patch(offerUpdate)

    return draftOrderPatch;
  })

  fastify.post("/api/shopify/updateShopConditions", async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    let shops = [];
    if (request.body['shopId']) {
      shops = await fastify.objection.models.shopifyStores.query().where('shop_id', '=', request.body.shopId);
    } else {
      return 'no shop specified';
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
    allDraftOrders.forEach((draftOrder) => {
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
      await delay(1000);
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
  });

  fastify.post('/api/shopify/deleteProductData', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    const {shopId, uuid, productId} = request.body;
    console.log('SHop', shopId)
    console.log('uuid', uuid)
    if (!shopId || !uuid) {
      return `Missing shopId or uuid.`
    }

    const shop = await fastify.objection.models.shopifyStores.query()
      .where("shop_id", "=", shopId);

    console.log('check shop', shop)

    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    let assetId;

    if (!!productId) {
      assetId = productId;
    } else {
      const draftOrder = await fastify.objection.models.shopifyDraftOrders.query().where('id', '=', uuid)

      console.log('check draftOrder', draftOrder[0])

      let parsedAssetId = JSON.parse(draftOrder[0].assetIdOnService);
      console.log('parsedAssetId', parsedAssetId)
      const splitAssetId = parsedAssetId[0].split('Product/');
      console.log('splitAssetId', splitAssetId)
      assetId = splitAssetId.pop()

      console.log('assetId', assetId)
    }

    const metafieldPromise = await shopify.metafield.list({
      metafield: {
        owner_resource: 'product',
        owner_id: assetId
      }
    })

    const resolvedMetafieldsPromise = await Promise.all(metafieldPromise);

    let filteredMetafields = [];
    resolvedMetafieldsPromise.forEach((m, i) => {
      if (m.namespace === 'lit_offer') {
        filteredMetafields.push(m)
      }
    })

    console.log('filteredMetafields', filteredMetafields)
    // return filteredMetafields

    const checkDelete = filteredMetafields.flat().map(async meta => {
      return await shopify.metafield.delete(meta.id);
    })

    return checkDelete;

  });

  fastify.post("/api/shopify/deleteSpecific", async (request, reply) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    const {uuid} = request.body;
    const allResults = await fastify.objection.models.shopifyDraftOrders
      .query()
      .delete()
      .where('id', '=', uuid);

    return allResults;
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
    console.log('-----> ids', ids)

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

  fastify.post('/api/shopify/manuallyUpdateRedeemedList', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    const draftOrder = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', request.body.uuid);

    console.log('request.body', request.body)
    console.log('draftOrder', draftOrder[0])
    let parsedDraftOrderList = JSON.parse(draftOrder[0].redeemedBy);
    const parsedRedeemedList = JSON.parse(request.body.redeemedList);
    console.log('parsedRedeemedList', typeof parsedRedeemedList)
    parsedDraftOrderList['solRpc'] = parsedRedeemedList;
    console.log('parsedDraftOrderList', typeof parsedDraftOrderList)
    const updatedConditions = JSON.stringify(parsedDraftOrderList);

    const patched = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', request.body.uuid)
      .patch({
        redeemedBy: updatedConditions
      })

    return patched;
    // return parsedDraftOrderList

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

      await delay(300);

      return await updateProductWithTagAndUuid(shopify, camelCaseQuery)
    })
    const resolvedUpdatedMetadata = await Promise.all(updatedMetadata);
    return resolvedUpdatedMetadata;
  })

  fastify.post('/api/shopify/recreateIndividualProductMetadata', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    const {shopId, uuid} = request.body;

    const shop = await fastify.objection.models.shopifyStores
      .query()
      .where("shop_id", "=", shopId);

    // adds exclusive or discount tag to product
    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    let draftOrders = await fastify.objection.models.shopifyDraftOrders
      .query().where('id', '=', uuid);

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

  fastify.post("/api/shopify/checkOnDraftOrders", async (request, reply) => {
    const {name, pass, getEmptyFields, shopId} = request.body;

    if (pass !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    let specificStore = null;
    let draftOrders = null;
    let allDraftOrders;
    let allStores = [];
    if (!!getEmptyFields) {
      draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query().where("offer_type", "=", null)
    } else if (name === 'all') {
      const allStoresHolder = await fastify.objection.models.shopifyStores
        .query()
      draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
      allStores = allStoresHolder.map(s => {
        let tempStore = s;
        delete tempStore.accessToken;
        return tempStore;
      })
    } else if (!!shopId) {
      specificStore = await fastify.objection.models.shopifyStores
        .query()
        .where('shop_id', '=', shopId);

      draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
        .where("shop_id", "=", specificStore[0].shopId);
    } else if (!!name) {
      specificStore = await fastify.objection.models.shopifyStores
        .query()
        .where('shop_name', '=', shortenShopName(name));

      if (specificStore[0].accessToken) {
        delete specificStore[0].accessToken;
      }

      console.log('check specific store', specificStore)

      draftOrders = await fastify.objection.models.shopifyDraftOrders
        .query()
        .where("shop_id", "=", specificStore[0].shopId);
    }

    return {
      specificStore: specificStore,
      storeDraftOrders: draftOrders,
      allStores: allStores,
      length: draftOrders.length
    };
  });

  fastify.post("/api/shopify/updateAccessToken", async (request, reply) => {
    const {name, pass} = request.body;

    if (pass !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    if (name !== null) {
      const store = await fastify.objection.models.shopifyStores.query()
        .where('shop_name', '=', shortenShopName(name));

      console.log('store', store)

      const oldAccessToken = store[0].accessToken;

      const postData = {
        client_id: process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_API_KEY,
        client_secret: process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET,
        refresh_token: process.env.SHOPIFY_TEMP_REFRESH_TOKEN,
        access_token: oldAccessToken,
      }
      console.log('CHECK REQUEST URL')
      let success = true;

      try {
        const response = await axios.post(`https://${name}.myshopify.com/admin/oauth/access_token.json`, postData);

        const newAccessToken = response.data["access_token"]

        console.log('CHECK DATA ON UPDATE', response.data)
        console.log('CHECK ACCESS TOKEN', newAccessToken)
        const updatedStore = await fastify.objection.models.shopifyStores.query()
          .where('shop_name', '=', shortenShopName(name))
          .patch({
            access_token: newAccessToken
          })
        console.log('updatedStore', updatedStore)
      } catch (err) {
        success = false
        console.log('unable to update', err)
      }
      return success;

    } else {
      const arrayOfShops = await fastify.objection.models.shopifyStores.query()
      await recursiveUpdateAccessToken(arrayOfShops, fastify);
    }

  })

  fastify.post("/api/shopify/deleteStore", async (request, reply) => {
    const {name, pass} = request.body;

    if (pass !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    return await fastify.objection.models.shares
      .query()
      .delete()
      .where("shop_name", "=", name);

  })

}