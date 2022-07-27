import dotenv from "dotenv";
import {
  checkNftIdValidity,
  checkUserValidity,
  checkWalletAddressValidity
} from "./shopifyHelpers/shopifyUserRedemptions.js";

dotenv.config({
  path: "../../env",
});

export default async function shopifyThemeAppExtensionEndpoints(fastify, opts) {
  fastify.post("/api/shopify/getRedeemStats", async (request, reply) => {
    const {token, offerArray, authSig} = request.body;

    const offerDataArray = offerArray.map(async offer => {
      const offerDataHolder = await fastify.objection.models.shopifyDraftOrders.query().where('id', '=', offer.offerId)
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