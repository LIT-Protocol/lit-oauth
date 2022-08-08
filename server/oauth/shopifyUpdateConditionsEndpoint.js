import { makeShopifyInstance, updateProductWithTagAndUuid } from "./shopifyHelpers/shopifyApiNodeHelpers.js";
import dotenv from "dotenv";

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
    unifiedAccessControlConditions,
    chainsUsed,
    conditionTypes
  };
}

const getAndUpdateOldOffers = async (fastify, allOffers) => {
  let newOffers = [];
  let oldOffers = [];
  allOffers.forEach(o => {
    try {
      const parsedAssetId = JSON.parse(o.assetIdOnService);
      newOffers.push(o);
    } catch (err) {
      oldOffers.push(o);
    }
  })

  if (!oldOffers.length) {
    return false;
  }

  const updatedOldOffers = oldOffers.map(o => {
    let offerHolder = JSON.parse(JSON.stringify(o));
    console.log('o', o)

    // update access control conditions
    const parsedAcc = JSON.parse(o.accessControlConditions);
    const updatedUaccObj = updateConditionTypes(parsedAcc);
    offerHolder.accessControlConditions = JSON.stringify(updatedUaccObj.unifiedAccessControlConditions);

    // update assetIdOnService
    offerHolder.assetIdOnService = JSON.stringify([ o.assetIdOnService ]);

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
    parsedDraftOrderDetails['hasRedeemLimit'] = parsedDraftOrderDetails['redeemLimit'] > 0 ? true : false;
    parsedDraftOrderDetails['id'] = [ parsedDraftOrderDetails.id ];
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

    const allShops = await fastify.objection.models.shopifyStores.query();
    // const allOffers = await fastify.objective.models.shopifyDraftOrders.query().where('shopId', '=', request.body.shopId)
    console.log('allShops', allShops);
  })
}