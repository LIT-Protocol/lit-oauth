import axios from "axios";

export const checkWalletContents = async (walletAddress) => {
  const getInfo = await axios.get(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}/getNFTs/?owner=${walletAddress}`)
  return getInfo;
}