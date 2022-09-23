import { makeDraftOrder } from "./shopifyApiNodeHelpers.js";

export const createPrepopulateEntry = async (fastify, shopify, draftOrderId, prepopulateData) => {
  let product;
  try {
    product = await shopify.product.get(request.body.productId);
  } catch (err) {
    console.error(`----> Error getting product for ${shop[0].shopName}:`, err);
    return err;
  }

  const query = await fastify.objection.models.shopifyPrepopulate
    .query()
    .insert({
      draft_order_id: draftOrderId,
      draft_orders: [],
      prepopulate_data: prepopulateData
    });

  return query;
}

export const toggleRecursiveCalls = ({fastify, shopify, offerId}) => {

  setTimeout(async () => {
    await makeRecursiveCall({fastify, shopify, offerId})
  }, 500);
}

const makeRecursiveCall = async ({fastify, shopify, offerId, draftOrderDetails}) => {
  const draftOrderPrepopulateObj = await fastify.objection.models.shopifyPrepopulate
    .query()
    .where('draft_order_id', '=', offerId);

  console.log('draftOrderPrepopulateObj', draftOrderPrepopulateObj)

  const draftOrderKeys = Object.keys(draftOrderPrepopulateObj);

  let variantId = null;

  for (let i = 0; i < draftOrderKeys.length; i++) {
    if (!variantId) {
      const variantObj = draftOrderPrepopulateObj[draftOrderKeys[i]];
      if (variantObj.status === 'complete') {
        return;
      }
      const draftOrderLength = variantObj.draftOrderUrls.length;
      if (draftOrderLength >= variantObj.numberOfOrders) {
        variantObj.status = 'complete';
        return;
      } else {
        variantId = draftOrderKeys[i];
      }
      return;
    } else {
      return;
    }
  }

  if (!variantId) {
    return;
  }

  try {
    const makeDraftOrderRes = await makeDraftOrder({
      shopify,
      selectedVariantsArray: [ variantId ],
      draftOrderDetails
    });
  } catch (err) {
    console.log('Error making draft order:', err);
  }

  setTimeout(async () => {
    await makeRecursiveCall(fastify, shopify, offerId);
  }, 500);
}