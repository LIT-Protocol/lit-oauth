// functions for checking user redemption status
import { checkEthereumNfts, checkPolygonNfts } from "./shopifyAlchemyHelpers.js";

export const updateMetrics = (fastify, offerData, shopName, redeemEntry) => {
  try {
    const currentOffer = fastify.objection.models.metrics.query().where('offer_uuid', '=', offerData.id)
    if (!currentOffer[0]) {
      let redeemedList = [
        redeemEntry
      ];

      const createRes = fastify.objection.models.metrics.query()
        .insert({
          offer_uuid: offerData.id,
          store_id: offerData.shopId,
          draft_order_details: offerData.draftOrderDetails,
          asset_id_on_service: offerData.assetIdOnService,
          shop_name: shopName,
          list_of_redemptions: JSON.stringify(redeemedList)
        })
    } else {
      let parsedListOfRedemptions = JSON.parse(currentOffer[0].list_of_redemptions);
      parsedListOfRedemptions.push(redeemEntry);
      const stringifiedListOfRedemptions = JSON.stringify(parsedListOfRedemptions);

      const updateRes = fastify.objection.models.metrics
        .query()
        .where('offer_uuid', '=', offerData.id)
        .patch({
          list_of_redemptions: stringifiedListOfRedemptions
        })
    }
  } catch (err) {
    console.log('Error saving metric:', err);
  }
}

export const checkUserValidity = async (offerData, authSig) => {
  let redemptionStatus = {
    allowRedeem: true,
    message: ''
  };
  const parsedDraftOrderDetails = JSON.parse(offerData.draftOrderDetails);
  if (!parsedDraftOrderDetails.hasRedeemLimit) {
    return redemptionStatus;
  } else if (parsedDraftOrderDetails.typeOfRedeem === 'walletAddress') {
    const redemptionValidity = await checkWalletAddressValidity(offerData, authSig, parsedDraftOrderDetails);
    redemptionStatus = redemptionValidity;
  } else if (parsedDraftOrderDetails.typeOfRedeem === 'nftId') {
    const redemptionValidity = await checkNftIdValidity(offerData, parsedDraftOrderDetails, authSig);
    redemptionStatus = redemptionValidity;
  }

  return redemptionStatus;
}

export const checkWalletAddressValidity = async (offerData, authSig, parsedDraftOrderDetails) => {
  let redemptionStatus = {
    allowRedeem: true,
    message: ''
  };
  const conditionTypesArray = offerData.conditionTypes.split(',');
  const parsedRedeemedBy = JSON.parse(offerData.redeemedBy);
  if (conditionTypesArray.indexOf('evmBasic') !== -1 && authSig?.['ethereum'] && authSig?.ethereum?.['address']) {
    // separate into different if statements for ease of reading.  above is conditions checking for condition type and existence of authSig.
    // below is checking the redeemed by object for the existence of that particular wallet's existence
    if (parsedRedeemedBy?.evmBasic?.[authSig.ethereum.address] &&
      parsedRedeemedBy?.evmBasic?.[authSig.ethereum.address] >= parsedDraftOrderDetails.redeemLimit) {
      redemptionStatus.allowRedeem = false;
      redemptionStatus.message = [ 'You have reached the limit for allowed number of redemptions.' ]
    }
  } else if (conditionTypesArray.indexOf('solRpc') > -1 && authSig?.['solana'] && authSig?.solana?.['address']) {
    if (parsedRedeemedBy?.solRpc?.[authSig.solana.address] &&
      parsedRedeemedBy?.solRpc?.[authSig.solana.address] >= parsedDraftOrderDetails.redeemLimit) {
      redemptionStatus.allowRedeem = false;
      redemptionStatus.message = [ 'You have reached the limit for allowed number of redemptions.' ]
    }
  }
  return redemptionStatus;
}

export const checkNftIdValidity = async (offerData, parsedDraftOrderDetails, authSig) => {
  const parsedUacc = JSON.parse(offerData.accessControlConditions);
  const uaccContractAddress = parsedUacc[0].contractAddress.toLowerCase();
  let chain = parsedUacc[0].chain;
  let availableNfts = null;
  if (chain === 'ethereum') {
    const walletEthereumHoldings = await checkEthereumNfts(authSig.ethereum.address);
    availableNfts = walletEthereumHoldings.data.ownedNfts.filter(nft => {
      return nft.contract.address.toLowerCase() === uaccContractAddress;
    });
  }
  if (chain === 'polygon') {
    const walletPolygonHoldings = await checkPolygonNfts(authSig.ethereum.address);
    availableNfts = walletPolygonHoldings.data.ownedNfts.filter(nft => {
      return nft.contract.address.toLowerCase() === uaccContractAddress;
    });
  }

  return checkForNftRedeem({
    chain, availableNfts, parsedDraftOrderDetails, offerData, uaccContractAddress
  });
}

const checkForNftRedeem = ({chain, availableNfts, parsedDraftOrderDetails, offerData, uaccContractAddress}) => {
  let parsedRedeemedNfts = JSON.parse(offerData.redeemedNfts);
  let redemptionStatus = {
    allowRedeem: false,
    message: [ 'You have reached the limit for allowed number of redemptions.' ],
    evaluatedNfts: []
  };

  // map through nfts, and if limit has not been reached, call as true
  availableNfts.forEach(nft => {
    const currentNftId = nft.id.tokenId.toLowerCase();
    if (!parsedRedeemedNfts[chain] ||
      !parsedRedeemedNfts[chain][uaccContractAddress] ||
      !parsedRedeemedNfts[chain][uaccContractAddress][currentNftId] ||
      (parseInt(parsedRedeemedNfts[chain][uaccContractAddress][currentNftId]) < parseInt(parsedDraftOrderDetails.redeemLimit))) {
      redemptionStatus.allowRedeem = true;
      redemptionStatus.message = '';
      const nftInfoObj = {
        nft,
        canRedeem: true
      }
      redemptionStatus.evaluatedNfts.push(nftInfoObj);
    } else {
      const nftInfoObj = {
        nft,
        canRedeem: false
      }
      redemptionStatus.evaluatedNfts.push(nftInfoObj);
    }
  });

  return redemptionStatus;
}


// wallets have two subcategories, evmBasic and solRpc, since EVM chains can use the same wallet
export const updateWalletAddressRedeem = async (fastify, authSig, offerData) => {
  let metricObject = {
    time: Date.now(),
    type: 'walletAddress',
    solanaAddress: '',
    ethereumAddress: '',
  }

  const conditionTypesArray = offerData.conditionTypes.split(',');
  let parsedRedeemedBy = JSON.parse(offerData.redeemedBy);
  if (conditionTypesArray.indexOf('evmBasic') > -1 && authSig['ethereum']) {
    if (!parsedRedeemedBy['evmBasic']) {
      parsedRedeemedBy['evmBasic'] = {};
    }
    if (!parsedRedeemedBy['evmBasic'][authSig.ethereum.address]) {
      parsedRedeemedBy['evmBasic'][authSig.ethereum.address] = 1;
    } else {
      parsedRedeemedBy['evmBasic'][authSig.ethereum.address] = parsedRedeemedBy['evmBasic'][authSig.ethereum.address] + 1;
    }
    metricObject.ethereumAddress = authSig.ethereum.address;
  }
  if (conditionTypesArray.indexOf('solRpc') > -1 && authSig['solana']) {
    if (!parsedRedeemedBy['solRpc']) {
      parsedRedeemedBy['solRpc'] = {};
    }
    if (!parsedRedeemedBy['solRpc'][authSig.solana.address]) {
      parsedRedeemedBy['solRpc'][authSig.solana.address] = 1;
    } else {
      parsedRedeemedBy['solRpc'][authSig.solana.address] = parsedRedeemedBy['solRpc'][authSig.solana.address] + 1;
    }
    metricObject.solanaAddress = authSig.solana.address;
  }

  const updatedRedeemedByList = JSON.stringify(parsedRedeemedBy);

  const updateRedeemByRes = await fastify.objection.models.shopifyDraftOrders
    .query()
    .where("id", "=", offerData.id)
    .patch({
      'redeemed_by': updatedRedeemedByList
    });

  return metricObject;
}

// nft id needs to be organized by individual chains since nfts don't exist cross chain
export const updateNftIdRedeem = async (fastify, selectedNft, offerData) => {
  const usedChain = offerData.usedChains;
  const contractAddress = selectedNft.nft.contract.address.toLowerCase();
  const tokenId = selectedNft.nft.id.tokenId.toLowerCase();
  const parsedRedeemedNfts = JSON.parse(offerData.redeemedNfts);

  if (!parsedRedeemedNfts[usedChain]) {
    parsedRedeemedNfts[usedChain] = {};
  }
  if (!parsedRedeemedNfts[usedChain][contractAddress]) {
    parsedRedeemedNfts[usedChain][contractAddress] = {};
  }
  if (!parsedRedeemedNfts[usedChain][contractAddress][tokenId]) {
    parsedRedeemedNfts[usedChain][contractAddress][tokenId] = 1;
  } else {
    parsedRedeemedNfts[usedChain][contractAddress][tokenId] = parsedRedeemedNfts[usedChain][contractAddress][tokenId] + 1;
  }

  const updatedRedeemedNftsList = JSON.stringify(parsedRedeemedNfts);

  const updateRedeemedNftsRes = await fastify.objection.models.shopifyDraftOrders
    .query()
    .where("id", "=", offerData.id)
    .patch({
      'redeemed_nfts': updatedRedeemedNftsList
    });

  let metricObject = {
    time: Date.now(),
    type: 'nftId',
    usedChain,
    contractAddress,
    tokenId
  }

  return metricObject;
}

export const updateV1WalletRedeemedBy = async (fastify, offerData) => {
  const parsedRedeemedBy = JSON.parse(offerData[0].redeemedBy);
  if (parsedRedeemedBy['evmBasic']) {
    return offerData;
  }
  const updatedParsedRedeemedBy = {
    evmBasic: parsedRedeemedBy
  }

  const updatedOfferDataResolve = await fastify.objection.models.shopifyDraftOrders
    .query()
    .where('id', '=', offerData[0].id)
    .patch({
      redeemed_by: JSON.stringify(updatedParsedRedeemedBy)
    });

  const updatedOfferData = await fastify.objection.models.shopifyDraftOrders
    .query()
    .where('id', '=', offerData[0].id);

  return updatedOfferData[0];
}