export const provisionAccess = async ({
                                        unifiedAccessControlConditions,
                                        draftOrderId,
                                        storedEVMAuthSig,
                                        storedSolanaAuthSig,
                                        offerData
                                      }) => {
  let conditionTypeArray;
  let authSigs = {};
  // for obsolete access control conditions where conditionTypes didn't exist
  if (!offerData['conditionTypes']) {
    authSigs['ethereum'] = storedEVMAuthSig;
  } else {
    conditionTypeArray = offerData.conditionTypes.split(',');
    conditionTypeArray.forEach(c => {
      if (c !== 'solRpc') {
        authSigs['ethereum'] = storedEVMAuthSig;
      } else if (c === 'solRpc') {
        authSigs['solana'] = storedSolanaAuthSig;
      }
    });
  }

  const resourceId = {
    baseUrl: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST,
    path: "/shopify/l/" + draftOrderId,
    orgId: "",
    role: "customer",
    extraData: "",
  };

  try {
    const jwt = await window.litNodeClient.getSignedToken({
      unifiedAccessControlConditions: unifiedAccessControlConditions,
      authSig: authSigs,
      resourceId: resourceId
    });

    return jwt;
  } catch (err) {
    console.log('Error getting JWT:', err)
    return null;
  }
}

// const updateV1ConditionTypes = (acc) => {
//   const unifiedAccessControlConditions = [];
//   for (let i = 0; i < acc.length; i++) {
//     if (Array.isArray(acc[i])) {
//       const updatedConditions = updateV1ConditionTypes(acc[i]);
//       unifiedAccessControlConditions.push(updatedConditions);
//     } else if (!!acc[i] && !!acc[i]['operator']) {
//       unifiedAccessControlConditions.push(acc[i]);
//     } else {
//       const accHolder = acc[i];
//       if (!accHolder['conditionType']) {
//         accHolder['conditionType'] = 'evmBasic';
//       }
//       if (!accHolder['conditionType']) {
//         accHolder['conditionTypes'] = accHolder['extraData']
//       }
//       unifiedAccessControlConditions.push(accHolder);
//     }
//   }
//   return unifiedAccessControlConditions;
// }
