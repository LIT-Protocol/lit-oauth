import jsonwebtoken from "jsonwebtoken";

export const validateMerchantToken = async (token) => {
  const removeBearer = token.split(' ');
  const splitToken = removeBearer[1];
  return new Promise((resolve, reject) => {
    // jsonwebtoken.verify(splitToken, process.env.LIT_CUSTOM_SHOPIFY_API_SECRET, { algorithms: ['H256'] }, (err, decoded) => {
    jsonwebtoken.verify(splitToken, process.env.LIT_PROTOCOL_SHOP_PROMOTIONAL_SECRET, [ 'H256' ], (err, decoded) => {
      if (err) reject(false);
      else if (decoded) resolve(decoded);
    })
  })
}

export const shortenShopName = (shopName) => {
  const splitName = shopName.split('.');
  return splitName[0];
}

export const parseAndUpdateUsedByList = (redeemedBy, userAddress) => {
  let updatedRedeemedBy = {};
  if (redeemedBy) {
    updatedRedeemedBy = JSON.parse(redeemedBy);
  }

  if (!updatedRedeemedBy[userAddress]) {
    updatedRedeemedBy[userAddress] = 1;
  } else {
    updatedRedeemedBy[userAddress] += 1;
  }

  return JSON.stringify(updatedRedeemedBy);
}
