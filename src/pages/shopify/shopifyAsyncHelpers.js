import axios from "axios";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const checkForPromotions = async (shopName, productGid) => {
  return await axios
    .post(API_HOST + "/api/shopify/checkForPromotions", {
      shopName,
      productGid
    });
}

export const getPromotion = async (uuid) => {
  return await axios
    .post(API_HOST + "/api/shopify/getPromotion", {
      uuid
    });
}

export const getOfferData = async (uuid) => {
  return await axios
    .post(API_HOST + "/api/shopify/getOfferData", {
      uuid
    });
}

export const setUpRedeemDraftOrder = async (uuid, jwt) => {
  return await axios
    .post(API_HOST + "/api/shopify/setUpDraftOrder", {
      uuid,
      jwt
    });
}

export const redeemDraftOrder = async (uuid, selectedProductVariant, jwt) => {
  return await axios
    .post(API_HOST + "/api/shopify/redeemDraftOrder", {
      uuid,
      selectedProductVariant,
      jwt
    });
}

export const getProductInformation = async (shopId, productId) => {
  return await axios
    .post(API_HOST + "/api/shopify/getProductInformation", {
      shopId,
      productId
    });
}

// export const getWalletNFTs = async (authSigs, unifiedAccessControlConditions) => {
//   return await axios
//     .post(API_HOST + "/api/shopify/getWalletNFTs", {
//       authSigs,
//       unifiedAccessControlConditions
//     });
// }