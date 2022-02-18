import HmacSHA256 from "crypto-js/hmac-sha256.js";
import CryptoJS from "crypto-js";
import jsonwebtoken from "jsonwebtoken";

export const checkValidHmacSignature = (queries, secret) => {
  const { hmac, shop } = queries;
  const queriesWithoutHmac = queries;
  delete queriesWithoutHmac['hmac'];

  let concatQueryString = ''
  const queryKeys = Object.keys(queriesWithoutHmac);
  for (let i = 0; i < queryKeys.length; i++) {
    concatQueryString += queryKeys[i] + '=' + queriesWithoutHmac[queryKeys[i]]
    if (i !== queryKeys.length - 1) {
      concatQueryString += '&'
    }
  }

  const hashQueryString = HmacSHA256(concatQueryString, secret).toString(CryptoJS.enc.Hex);

  return (hashQueryString === hmac);
}

export const validateMerchantToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    // jsonwebtoken.verify(splitToken, process.env.LIT_CUSTOM_SHOPIFY_API_SECRET, { algorithms: ['H256'] }, (err, decoded) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET, ['H256'], (err, decoded) => {
      if (err) reject(false);
      else if (decoded) resolve(decoded);
    })
  })
}

export const validateDoodlesToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_DOODLES_SECRET, ['H256'], (err, decoded) => {
      if (err) reject(false);
      else if (decoded) resolve(decoded);
    })
  })
}

export const shortenShopName = (shopName) => {
  const splitName = shopName.split('.');
  return splitName[0];
}

export const shortenProductId = (productId) => {
  const splitId = productId.split('/');
  return splitId[splitId.length - 1];
}
