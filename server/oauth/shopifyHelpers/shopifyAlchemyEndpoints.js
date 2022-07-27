import axios from "axios";

export const checkWalletEthereumNfts = async (walletAddress) => {
  const getInfo = await axios.get(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ETHEREUM_API_KEY}/getNFTs/?owner=${walletAddress}`)
  return getInfo;
}

export const checkWalletPolygonNfts = async (walletAddress) => {
  const getInfo = await axios.get(`https://polygon-mainnet.g.alchemy.com/nft/v2/${process.env.ALCHEMY_POLYGON_API_KEY}/getNFTs/?owner=${walletAddress}`)
  return getInfo;
}

// export const checkWalletArbitrumNfts = async (walletAddress) => {
//   const getInfo = await axios.get(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ARBITRUM_API_KEY}/getNFTs/?owner=${walletAddress}`)
//   return getInfo;
// }
//
// export const checkWalletOptimismNfts = async (walletAddress) => {
//   const getInfo = await axios.get(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_OPTIMISM_API_KEY}/getNFTs/?owner=${walletAddress}`)
//   return getInfo;
// }

export const checkWalletSolanaNfts = async (walletAddress) => {
  const getInfo = await axios.get(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_SOLANA_API_KEY}/getNFTs/?owner=${walletAddress}`)
  return getInfo;
}