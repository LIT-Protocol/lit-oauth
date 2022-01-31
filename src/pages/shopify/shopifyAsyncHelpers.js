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

export const getAccessControl = async (uuid) => {
  return await axios
    .post(API_HOST + "/api/shopify/getAccessControl", {
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

export const redeemDraftOrder = async (uuid, jwt) => {
  return await axios
    .post(API_HOST + "/api/shopify/redeemDraftOrder", {
      uuid,
      jwt
    });
}
