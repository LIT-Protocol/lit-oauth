import axios from "axios";
import jsonwebtoken from "jsonwebtoken";

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

export const checkWalletEthNFTs = async (walletAddress) => {
  console.log('process.env', process.env.ALCHEMY_API_KEY)
  let ethNFTs = null;
  try {
    ethNFTs = await axios.get(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}/getNFTs/?owner=${walletAddress}`);
    console.log('check eth nfts', ethNFTs.data)
  } catch(err) {
    console.log('BIG OLE ERROR')
  }
  return ethNFTs;
}

export const checkWalletSolanaNFTs = async (walletAddress) => {
  return true;
}