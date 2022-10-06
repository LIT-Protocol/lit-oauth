import { makePrepopulateDraftOrder } from "./shopifyApiNodeHelpers.js";

export const createPrepopulateEntry = async ({
                                               fastify,
                                               draftOrderId,
                                               productDetails,
                                               prepopulateData
                                               // shopify,
                                               // shop,
                                               // draftOrderDetails,
                                             }) => {
  // Note: to be removed when this supports more than one product
  const singularProduct = productDetails;

  const query = await fastify.objection.models.shopifyPrepopulate
    .query()
    .insert({
      draft_order_id: draftOrderId,
      prepopulate_data: JSON.stringify(prepopulateData),
      product_details: JSON.stringify(singularProduct),
    });

  return query;
}

export const toggleRecursiveCalls = ({fastify, shopify, offerId, parsedDraftOrderDetails}) => {
  setTimeout(async () => {
    await makeRecursiveCall({
      fastify,
      shopify,
      offerId,
      parsedDraftOrderDetails
    })
  }, 500);
}

const makeRecursiveCall = async ({fastify, shopify, offerId, parsedDraftOrderDetails, currentVariantId = null}) => {
  console.log('-------> START OF MAKE RECURSIVE')

  // get prepopulate object
  let draftOrderPrepopulateObj = null;
  try {
    draftOrderPrepopulateObj = await fastify.objection.models.shopifyPrepopulate
      .query()
      .where('draft_order_id', '=', offerId);
  } catch (err) {
    console.log('No draft order object');
    return;
  }

  // deep copy object
  let draftOrderPrepopulateObjHolder = JSON.parse(JSON.stringify(draftOrderPrepopulateObj[0]));

  // get keys for each variant
  const draftOrderKeys = Object.keys(draftOrderPrepopulateObjHolder.prepopulateData);

  // check declare variant to pass back through, define it if null
  let currentVariantIdHolder = currentVariantId;
  if (!currentVariantId) {
    currentVariantIdHolder = draftOrderKeys[0];
  }

  // add information needed for draft order creation
  let currentVariantObj = null;
  draftOrderPrepopulateObjHolder.productDetails[0].variants.forEach(v => {
    if (v.id.split('/').pop() === currentVariantIdHolder) {
      currentVariantObj = v;
      currentVariantObj['productTitle'] = draftOrderPrepopulateObjHolder.productDetails[0].title;
      currentVariantObj['productId'] = draftOrderPrepopulateObjHolder.productDetails[0].id;
    }
  });

  let makePrepopulateDraftOrderRes = null;
  try {
    makePrepopulateDraftOrderRes = await makePrepopulateDraftOrder({
      shopify,
      selectedVariantsArray: [ currentVariantObj ],
      parsedDraftOrderDetails
    });
    draftOrderPrepopulateObjHolder.prepopulateData[currentVariantIdHolder].draftOrderUrls.push({
      redeemUrl: makePrepopulateDraftOrderRes.redeemUrl,
      used: false,
    })
  } catch (error) {
    draftOrderPrepopulateObjHolder.errors.push({
      error,
      variant: currentVariantIdHolder,
      time: Date.now()
    })
    console.log('Error calling makePrepopulateDraftOrder:', error);
  }

  // update completed variant status
  if (draftOrderPrepopulateObjHolder.prepopulateData[currentVariantIdHolder].draftOrderUrls.length >= draftOrderPrepopulateObjHolder.prepopulateData[currentVariantIdHolder].numberOfOrders) {
    draftOrderPrepopulateObjHolder.prepopulateData[currentVariantIdHolder].status = 'complete';
  }

  // check for incomplete variants based on the `status` property
  const incompleteVariants = [];
  Object.keys(draftOrderPrepopulateObjHolder.prepopulateData).forEach(v => {
    if (draftOrderPrepopulateObjHolder.prepopulateData[v].status !== 'complete') {
      incompleteVariants.push(v);
    }
  })

  try {
    let prepopulateWriteRes = await fastify.objection.models.shopifyPrepopulate
      .query()
      .where('draft_order_id', '=', offerId)
      .patch({
        prepopulate_data: JSON.stringify(draftOrderPrepopulateObjHolder.prepopulateData)
      })
  } catch (err) {
    console.log('Error writing pre-populate object to DB:', err)
  }

  // if no incomplete variants are left, stop recursion
  if (incompleteVariants && incompleteVariants.length) {
    currentVariantIdHolder = incompleteVariants[0];
  } else if (draftOrderPrepopulateObjHolder.errors && draftOrderPrepopulateObjHolder.errors.length > 10) {
    // the choice of 10 errors is completely arbitrary
    return
  } else {
    return;
  }

  setTimeout(async () => {
    await makeRecursiveCall({
      fastify,
      shopify,
      offerId,
      parsedDraftOrderDetails,
      currentVariantId: currentVariantIdHolder
    });
  }, 500)
}