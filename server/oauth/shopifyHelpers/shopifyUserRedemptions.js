// functions for checking user redemption status
import { checkWalletEthereumNfts, checkWalletPolygonNfts } from "./shopifyAlchemyEndpoints.js";

export const checkUserValidity = async (offerData, authSig) => {
  let redemptionStatus = {
    allowRedeem: true,
    message: ''
  };
  const draftOrderDetails = JSON.parse(offerData.draftOrderDetails);
  if (!draftOrderDetails.hasRedeemLimit) {
    return redemptionStatus;
  } else if (draftOrderDetails.typeOfRedeem === 'walletAddress') {
    const redemptionValidity = await checkWalletAddressValidity(offerData, authSig, draftOrderDetails);
    redemptionStatus = redemptionValidity;
  } else if (draftOrderDetails.typeOfRedeem === 'nftId') {
    const redemptionValidity = await checkNftIdValidity(offerData, draftOrderDetails, authSig);
    redemptionStatus = redemptionValidity;
  }

  return redemptionStatus;

}

export const checkWalletAddressValidity = async (offerData, authSig, draftOrderDetails) => {
  let redemptionStatus = {
    allowRedeem: true,
    message: ''
  };
  const conditionTypesArray = offerData.conditionTypes.split(',');
  const redeemedByObject = JSON.parse(offerData.redeemedBy);
  if (conditionTypesArray.indexOf('evmBasic') > -1 && authSig?.ethereum?.[authSig.ethereum.address]) {
    // separate into different if statements for ease of reading.  above is conditions checking for condition type and existence of authSig.
    // below is checking the redeemed by object for the existence of that particular wallet's existence
    if (redeemedByObject?.evmBasic?.[authSig.ethereum.address] &&
      redeemedByObject?.evmBasic?.[authSig.ethereum.address] > draftOrderDetails.redeemLimit) {
      redemptionStatus.allowRedeem = false;
      redemptionStatus.message = 'You have reached the limit for redemptions.'
    }
  } else if (conditionTypesArray.indexOf('solRpc') > -1 && authSig?.solana?.[authSig.solana.address]) {
    if (redeemedByObject?.solRpc?.[authSig.solana.address] &&
      redeemedByObject?.solRpc?.[authSig.solana.address] > draftOrderDetails.redeemLimit) {
      redemptionStatus.allowRedeem = false;
      redemptionStatus.message = 'You have reached the limit for redemptions.'
    }
  }
  return redemptionStatus;
}

export const checkNftIdValidity = async (offerData, draftOrderDetails, authSig) => {
  const parsedUacc = JSON.parse(offerData.accessControlConditions);
  const uaccContractAddress = parsedUacc[0].contractAddress.toLowerCase();
  let chain = parsedUacc[0].chain;
  let availableNfts = null;
  if (chain === 'ethereum') {
    const walletEthereumHoldings = await checkWalletEthereumNfts(authSig.ethereum.address);
    availableNfts = walletEthereumHoldings.data.ownedNfts.filter(nft => {
      return nft.contract.address.toLowerCase() === uaccContractAddress;
    });
  }
  if (chain === 'polygon') {
    const walletPolygonHoldings = await checkWalletPolygonNfts(authSig.ethereum.address);
    availableNfts = walletPolygonHoldings.data.ownedNfts.filter(nft => {
      return nft.contract.address.toLowerCase() === uaccContractAddress;
    });
  }

  return checkForNftRedeem({
    chain, availableNfts, draftOrderDetails, offerData, uaccContractAddress
  });
}

const checkForNftRedeem = ({chain, availableNfts, draftOrderDetails, offerData, uaccContractAddress}) => {
  let parsedRedeemedNfts = JSON.parse(offerData.redeemedNfts);
  let redemptionStatus = {
    allowRedeem: false,
    message: 'You have reached the limit for allowed number of redemptions.',
    evaluatedNfts: []
  };

  // map through nfts, and if limit has not been reached, call as true
  availableNfts.forEach(nft => {
    const currentNftId = nft.id.tokenId.toLowerCase();
    if (!parsedRedeemedNfts[chain] ||
      !parsedRedeemedNfts[chain][uaccContractAddress] ||
      !parsedRedeemedNfts[chain][uaccContractAddress][currentNftId] ||
      (parseInt(parsedRedeemedNfts[chain][uaccContractAddress][currentNftId]) < parseInt(draftOrderDetails.redeemLimit))) {
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

// const checkForPolygonNftRedeem = async (offerData, draftOrderDetails, authSig, parsedUacc) => {
//   let updatedRedeemedBy = JSON.parse(offerData.redeemedNfts);
//   const uaccContractAddress = parsedUacc[0].contractAddress.toLowerCase();
//   const walletPolygonHoldings = await checkWalletPolygonNfts(authSig.ethereum.address);
//   const viableNfts = walletPolygonHoldings.data.ownedNfts.filter(nft => {
//     return nft.contract.address.toLowerCase() === uaccContractAddress;
//   });
//
//   console.log('viable POLYGON', viableNfts)
//
//   // TODO: expand redemption status object to show that they have already redeemed
//   let redemptionStatus = {
//     allowRedeem: false,
//     message: 'You have reached the limit for allowed number of redemptions.',
//     evaluatedNfts: []
//   };
//
//   // map through nfts, and if limit has not been reached, call as true
//   viableNfts.forEach(nft => {
//     const currentNftId = nft.id.tokenId.toLowerCase();
//     if (!updatedRedeemedBy['polygon'] ||
//       !updatedRedeemedBy['polygon'][uaccContractAddress] ||
//       !updatedRedeemedBy['polygon'][uaccContractAddress][currentNftId] ||
//       (parseInt(updatedRedeemedBy['polygon'][uaccContractAddress][currentNftId]) < parseInt(draftOrderDetails.redeemLimit))) {
//       redemptionStatus.allowRedeem = true;
//       redemptionStatus.message = '';
//       const nftInfoObj = {
//         nft,
//         canRedeem: true
//       }
//       redemptionStatus.evaluatedNfts.push(nftInfoObj);
//     } else {
//       const nftInfoObj = {
//         nft,
//         canRedeem: false
//       }
//       redemptionStatus.evaluatedNfts.push(nftInfoObj);
//     }
//   });
//
//   return redemptionStatus;
// }
//
// const checkForEthereumNftRedeem = async (offerData, draftOrderDetails, authSig, parsedUacc) => {
//   let updatedRedeemedBy = JSON.parse(offerData.redeemedNfts);
//   const uaccContractAddress = parsedUacc[0].contractAddress.toLowerCase();
//   const walletPolygonHoldings = await checkWalletEthereumNfts(authSig.ethereum.address);
//   const viableNfts = walletPolygonHoldings.data.ownedNfts.filter(nft => {
//     return nft.contract.address.toLowerCase() === uaccContractAddress;
//   });
//
//   // TODO: expand redemption status object to show that they have already redeemed
//   let redemptionStatus = {
//     allowRedeem: false,
//     message: 'You have reached the limit for allowed number of redemptions.',
//     evaluatedNfts: []
//   };
//
//   // map through nfts, and if limit has not been reached, call as true
//   viableNfts.forEach((nft, i) => {
//     const currentNftId = nft.id.tokenId.toLowerCase();
//     if (!updatedRedeemedBy['ethereum'] ||
//       !updatedRedeemedBy['ethereum'][uaccContractAddress] ||
//       !updatedRedeemedBy['ethereum'][uaccContractAddress][currentNftId] ||
//       (parseInt(updatedRedeemedBy.ethereum[uaccContractAddress][currentNftId]) < parseInt(draftOrderDetails.redeemLimit))) {
//       redemptionStatus.allowRedeem = true;
//       redemptionStatus.message = '';
//       const nftInfoObj = {
//         nft,
//         canRedeem: true
//       }
//       redemptionStatus.evaluatedNfts.push(nftInfoObj);
//     } else {
//       const nftInfoObj = {
//         nft,
//         canRedeem: false
//       }
//       redemptionStatus.evaluatedNfts.push(nftInfoObj);
//     }
//   });
//
//   return redemptionStatus;
// }

// functions for updating user redemption status
export const checkAndUpdateUserRedemption = async (offerData, authSig) => {
  const draftOrderDetails = JSON.parse(offerData.draftOrderDetails);
  console.log('checkAndUpdateUserRedemption', offerData)
  console.log('draftOrderDetails', draftOrderDetails)
  let allowRedeem = true;
  let updatedRedeemedObj;

  if (!draftOrderDetails.hasRedeemLimit) {
    return allowRedeem;
  }

  if (draftOrderDetails.typeOfRedeem === 'walletAddress') {
    const updatedRedeemState = checkAndUpdateWalletAddressRedeem(offerData, authSig);
    allowRedeem = updatedRedeemState.allowRedeem;
    updatedRedeemedObj = updatedRedeemState.parsedRedeemedBy;
  } else if (draftOrderDetails.typeOfRedeem = 'nftId') {
    const updatedRedeemState = checkAndUpdateNftIdRedeem(offerData, authSig);
    allowRedeem = true;
  }

  return {
    allowRedeem,
    updatedRedeemedObj
  };
}

// wallets have two subcategories, evmBasic and solRpc, since EVM chains can use the same wallet
const checkAndUpdateWalletAddressRedeem = async (offerData, authSig) => {
  let allowRedeem = true;
  const conditionTypeArray = offerData.conditionTypes.split(',');
  const parsedRedeemedBy = JSON.parse(offerData.redeemedBy);
  const parsedDraftOrderDetails = JSON.parse(offerData.draftOrderDetails);
  if (conditionTypeArray.indexOf('evmBasic') !== -1) {
    if (!parsedRedeemedBy?.evmBasic?.[authSig.evmBasic.address]) {
      parsedRedeemedBy.evmBasic[authSig.evmBasic.address] = 1;
    } else if (parsedRedeemedBy?.evmBasic?.[authSig.evmBasic.address] >= parsedDraftOrderDetails.redeemLimit) {
      allowRedeem = false;
    } else {
      parsedRedeemedBy.evmBasic[authSig.evmBasic.address] = parsedRedeemedBy.evmBasic[authSig.evmBasic.address] + 1;
    }
  }
  if (conditionTypeArray.indexOf('solRpc') !== -1) {
    if (!parsedRedeemedBy?.solRpc?.[authSig.solRpc.address]) {
      parsedRedeemedBy['solRpc'][authSig.solRpc.address] = 1;
    } else if (parsedRedeemedBy?.['solRpc'][authSig.solRpc.address] >= parsedDraftOrderDetails.redeemLimit) {
      allowRedeem = false;
    } else {
      parsedRedeemedBy.solRpc[authSig.solRpc.address] = parsedRedeemedBy.solRpc[authSig.solRpc.address] + 1;
    }
  }
  console.log('parsedRedeemedBy', parsedRedeemedBy)
  console.log('allowRedeem', allowRedeem)
  return {
    allowRedeem,
    parsedRedeemedBy
  };
}

// nft id needs to be organized by individual chains since nfts don't exist cross chain
const checkAndUpdateNftIdRedeem = async (offerData, authSig) => {

}

export const updateV1WalletRedeemedBy = async (fastify, offerData) => {
  const parsedRedeemedBy = JSON.parse(offerData[0].redeemedBy);
  if (parsedRedeemedBy['evmBasic']) {
    return offerData;
  }
  console.log('offerData', offerData)
  const updatedParsedRedeemedBy = {
    evmBasic: parsedRedeemedBy
  }

  console.log('updatedParsedRedeemedBy', updatedParsedRedeemedBy)
  const updatedOfferDataResolve = await fastify.objection.models.shopifyDraftOrders
    .query()
    .where('id', '=', offerData[0].id)
    .patch({
      redeemed_by: JSON.stringify(updatedParsedRedeemedBy)
    });

  const updatedOfferData = await fastify.objection.models.shopifyDraftOrders
    .query()
    .where('id', '=', offerData[0].id);

  console.log('updatedOfferData', updatedOfferData)
  return updatedOfferData[0];
}