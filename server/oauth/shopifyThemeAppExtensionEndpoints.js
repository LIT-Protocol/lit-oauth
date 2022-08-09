import dotenv from "dotenv";
import {
  checkUserValidity,
} from "./shopifyHelpers/shopifyUserRedemptions.js";
import LitJsSdk from "lit-js-sdk";
import { shortenShopName } from "./shopifyHelpers/shopifyReusableFunctions.js";
import { makeShopifyInstance, updateProductWithTagAndUuid } from "./shopifyHelpers/shopifyApiNodeHelpers.js";

dotenv.config({
  path: "../../env",
});

export default async function shopifyThemeAppExtensionEndpoints(fastify, opts) {
  fastify.post("/api/shopify/getRedeemStats", async (request, reply) => {
    console.log('start of redeem stats')
    const {jwt, offerArray, authSig, shopName, product} = request.body;

    let verified;
    let payload;
    try {
      const jwtData = LitJsSdk.verifyJwt({jwt});
      verified = jwtData.verified;
      payload = jwtData.payload;
    } catch (err) {
      return [];
    }

    if (!verified) {
      return [];
    }

    // TODO: start of reformat old conditions.  delete after updates are done

    // const shop = await fastify.objection.models.shopifyStores.query()
    //   .where('shop_name', '=', shortenShopName(shopName));
    //
    // const allOffers = await fastify.objection.models.shopifyDraftOrders.query().where('shop_id', '=', shop[0].shopId);
    //
    // const offersWithProduct = allOffers.filter(o => {
    //   if (o.assetIdOnService.includes(product)) {
    //     return o;
    //   }
    // });

    // let currentOfferArray = offerArray;

    // if (offersWithProduct.length !== offerArray.length) {
    //   const neededUpdate = await getAndUpdateOldOffers(fastify, offersWithProduct);
    //   currentOfferArray = offerArray.concat(neededUpdate);
    // }

    // TODO FOR TOMORROW: remove this check user validity and move below

    console.log('offerArray', offerArray)
    const offerDataArray = offerArray.map(async offer => {
      const offerDataHolder = await fastify.objection.models.shopifyDraftOrders.query().where('id', '=', offer.offerId)
      console.log('offerDataHolder', offerDataHolder)
      const offerData = offerDataHolder[0];
      try {
        offerData['redeemStatus'] = await checkUserValidity(offerData, authSig);
        offerData['redeemAddress'] = offer['redeemAddress'];
        offerData['resolved'] = offer['resolved'];
      } catch (err) {
        console.log('Error checking validity:', err);
        offerData['redeemFailureMessage'] = 'Error checking validity of offers';
        offerData['errorMessage'] = err;
      }
      return offerData;
    });

    const resolvedFoundOffersArray = await Promise.all(offerDataArray);

    return resolvedFoundOffersArray;


  });
}