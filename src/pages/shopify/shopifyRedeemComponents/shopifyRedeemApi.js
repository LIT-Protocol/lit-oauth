import axios from "axios";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const getOffer = async (uuid) => {
  return await axios
    .post(API_HOST + "/api/shopify/getOffer", {
      uuid
    });
}

export const checkForUserValidity = async ({uuid, jwt, authSig}) => {
  return await axios
    .post(API_HOST + "/api/shopify/checkForUserValidity", {
      uuid,
      jwt,
      authSig
    });
}

export const getAllOfferProducts = async ({uuid, jwt, authSig}) => {
  return await axios.post(API_HOST + "/api/shopify/getAllOfferProducts", {
    uuid,
    jwt,
    authSig
  });
}

export const redeemOfferAndUpdateUserStats = async (redeemOfferObj) => {
  return await axios.post(API_HOST + "/api/shopify/redeemOfferAndUpdateUserStats", redeemOfferObj);
}

export const getPrepopulateInfo = async ({uuid, jwt}) => {
  return await axios.post(
    `${API_HOST}/api/shopify/getPrepopulateInfo`,
    {
      uuid,
      jwt
    });
};

export const redeemPrepopulate = async (redeemOfferObj) => {
  return await axios.post(`${API_HOST}/api/shopify/redeemPrepopulate`, redeemOfferObj);
};