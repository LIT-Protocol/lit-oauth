import React, { Fragment, useEffect, useState } from "react";
import { useAppContext } from "../../../context/index.js";
import LitJsSdk from "lit-js-sdk";
import { getAllOfferProducts, getOffer } from "./shopifyRedeemApi.js";

import './ShopifyRedeem.css';
import ShopifySnackbar from "./ShopifySnackbar.js";
import ShopifyLoader from "./shopifyLoader/ShopifyLoader.js";
import ShopifyRedeemFailure from "./shopifyRedeemFailure/ShopifyRedeemFailure.js";
import { provisionAccess } from "./shopifyFrontendRedeemHelpers.js";
import { checkForUserValidity } from "./shopifyRedeemApi.js";
import ShopifyRedeemSuccess from "./shopifyRedeemSuccess/ShopifyRedeemSuccess.js";
import { IconButton, Tooltip } from "@mui/material";
import InfoIcon from '@mui/icons-material/Info';

const ShopifyRedeem = () => {
  const {performWithAuthSig} = useAppContext();

  // page status and error states
  const [ loading, setLoading ] = useState(true);
  const [ loaderMessage, setLoaderMessage ] = useState('Retrieving offer...');
  const [ openSnackbar, setOpenSnackbar ] = useState(false);
  const [ snackbarInfo, setSnackbarInfo ] = useState({message: '', severity: null});
  const [ showRedeemFailure, setShowRedeemFailure ] = useState(false);
  const [ redeemFailureMessage, setRedeemFailureMessage ] = useState({title: '', detailList: [], err: null});

  // lit status and auth sigs
  const [ connectedToLitNodeClient, setConnectedToLitNodeClient ] = useState(false);
  const [ accessVerified, setAccessVerified ] = useState(false);
  const [ storedEVMAuthSig, setStoredEVMAuthSig ] = useState(null);
  const [ storedSolanaAuthSig, setStoredSolanaAuthSig ] = useState(null);
  const [ currentJwt, setCurrentJwt ] = useState('');

  // draft order and offer data states
  const [ offerProducts, setOfferProducts ] = useState(null);
  const [ draftOrderId, setDraftOrderId ] = useState(null);
  const [ validityResponse, setValidityResponse ] = useState({});
  const [ humanizedAccessControlConditions, setHumanizedAccessControlConditions ] = useState(null);
  const [ offerData, setOfferData ] = useState(null);

  document.addEventListener('lit-ready', function (e) {
    console.log('lit-ready event listener')
    setConnectedToLitNodeClient(true);
  }, false);

  useEffect(() => {
    if (!connectedToLitNodeClient) {
      connectToLitNodeAndParseQueryParams();
    }
  }, [ connectedToLitNodeClient ]);

  useEffect(() => {
    if (!accessVerified && (storedSolanaAuthSig || storedEVMAuthSig)) {
      checkForRedemptionValidity();
    }
  }, [ accessVerified, storedSolanaAuthSig, storedEVMAuthSig ]);

  const toggleSnackbar = (message, severity) => {
    setSnackbarInfo({message, severity});
    setOpenSnackbar(true);
  }

  const connectToLitNodeAndParseQueryParams = async () => {
    let litNodeClient = new LitJsSdk.LitNodeClient();
    await litNodeClient.connect();
    window.litNodeClient = litNodeClient;
    const queryString = window.location.search;
    const queryParams = new URLSearchParams(queryString);
    const id = queryParams.get('id');
    setDraftOrderId(id);
    try {
      const resp = await getOffer(id);
      setOfferData(resp.data);
      setHumanizedAccessControlConditions(resp.data.humanizedAccessControlConditions);
      const authSigEncoded = queryParams.get('authSig');
      if (!!authSigEncoded) {
        parseAuthSigParam(authSigEncoded);
      } else {
        await getAuthSigs(resp.data.conditionTypes);
      }
    } catch (err) {
      console.log('Error getting access control', err);
      toggleSnackbar('Error getting access control: err', 'error')
    }
  }

  const parseAuthSigParam = (authSigEncoded) => {
    const authSigObj = JSON.parse(decodeURI(authSigEncoded));
    if (authSigObj['ethereum']) {
      setStoredEVMAuthSig(authSigObj.ethereum);
    }
    if (authSigObj['solana']) {
      console.log('CHECK SOLANA', authSigObj.solana)
      setStoredSolanaAuthSig(authSigObj.solana);
    }
    const updatedURL = window.location.href.split('&authSig=')[0];
    window.history.replaceState(null, 'Lit Token Access', updatedURL)
  }

  const getAuthSigs = async (chainString) => {
    // todo: remove eventually. this loads the EVM signature for obsolete condition types that don't have a chain string
    if (!chainString) {
      await getEVMAuthSig();
    } else {
      const chainArray = chainString.split(',');
      chainArray.forEach(c => {
        // todo: will need to update this as some point to describe EVM chains as something better than 'not solRpc'
        if (c !== 'solRpc' && !storedEVMAuthSig) {
          getEVMAuthSig();
        } else if (c === 'solRpc' && !storedSolanaAuthSig) {
          getSolanaAuthSig();
        }
      });
    }
  }

  const getEVMAuthSig = async () => {
    try {
      await performWithAuthSig(async (authSig) => {
        setStoredEVMAuthSig(authSig);
      }, {chain: 'ethereum'});
    } catch (err) {
      toggleSnackbar(`${err.message} - Make sure you are signed into Metamask`, 'error');
      setLoading(false);
    }
  }

  const getSolanaAuthSig = async () => {
    try {
      await performWithAuthSig(async (authSig) => {
        setStoredSolanaAuthSig(authSig);
      }, {chain: 'solana'})
    } catch (err) {
      toggleSnackbar(`${err.message} - Make sure you are signed into Phantom`, 'error');
      setLoading(false);
    }
  }

  const checkForPromotionAccessControl = async () => {
    const provisionAccessObj = {
      unifiedAccessControlConditions: JSON.parse(offerData.accessControlConditions),
      draftOrderId,
      storedEVMAuthSig,
      storedSolanaAuthSig,
      offerData
    }
    console.log('------> acc', JSON.parse(offerData.accessControlConditions))
    console.log('------> provisionAccessObj', provisionAccessObj)
    try {
      return provisionAccess(provisionAccessObj).then(jwt => {
        return jwt;
      });
    } catch (err) {
      // ADD_ERROR_HANDLING
      setLoading(false);
      toggleSnackbar('Access not verified', 'error');
      setAccessVerified(false);
      // handleUpdateError(err);
      console.log('Share not found:', err)
    }
  }

  const checkForRedemptionValidity = async () => {
    checkForPromotionAccessControl().then(async (jwt) => {
      try {
        const checkForUserValidityObj = {
          uuid: draftOrderId,
          jwt,
          authSig: {
            ethereum: storedEVMAuthSig,
            solana: storedSolanaAuthSig
          }
        }
        const redemptionValidityResp = await checkForUserValidity(checkForUserValidityObj);
        console.log('redemptionValidityResp', redemptionValidityResp)
        setValidityResponse(redemptionValidityResp);
        setLoading(false);
        if (!redemptionValidityResp.data.allowRedeem) {
          toggleRedeemFailure('Error checking offer validity', redemptionValidityResp.data.message, '');
          setShowRedeemFailure(true);
        } else {
          setAccessVerified(true);
          setCurrentJwt(jwt);
          await setUpProducts(checkForUserValidityObj);
        }
      } catch (err) {
        toggleRedeemFailure('Error checking offer validity', [], err);
      }
    })
  }

  const setUpProducts = async (checkForUserValidityObj) => {
    setLoaderMessage('Retrieving products...');
    setLoading(true);
    let resolvedProductArray = null;
    try {
      resolvedProductArray = await getAllOfferProducts(checkForUserValidityObj);
    } catch (err) {
      toggleRedeemFailure('Error getting products.', [], err)
    }
    setOfferProducts(resolvedProductArray.data);
    setLoading(false);
  }

  const toggleRedeemFailure = (title, detailList, err) => {
    setRedeemFailureMessage({
      title,
      detailList,
      err
    })
    setShowRedeemFailure(true);
  }

  const testSnackbar = () => {
    toggleSnackbar('error snackbar', 'error')
  }

  const getState = () => {
    if (loading) {
      return (
        <div className={'lit-loading-container'}>
          <ShopifyLoader loaderMessage={loaderMessage}/>
        </div>
      )
    }
    if (showRedeemFailure) {
      return (
        <div className={'lit-fail-container'}>
          <ShopifyRedeemFailure redeemFailureMessage={redeemFailureMessage}/>
        </div>
      )
    }
    if (accessVerified && offerProducts) {
      return (
        <div className={'lit-success-container'}>
          <ShopifyRedeemSuccess offerData={offerData}
                                offerProducts={offerProducts}
                                currentJwt={currentJwt}
                                storedEVMAuthSig={storedEVMAuthSig}
                                storedSolanaAuthSig={storedSolanaAuthSig}
                                validityResponse={validityResponse.data}
                                toggleRedeemFailure={toggleRedeemFailure}
          ></ShopifyRedeemSuccess>
        </div>
      )
    }
  }

  return (
    <div className={'lit-shopify-container'}>
      {/*Shopify Redeem v3*/}
      {/*<button onClick={testSnackbar}>test snackbar</button>*/}
      {getState()}
      <ShopifySnackbar snackbarInfo={snackbarInfo} openSnackbar={openSnackbar} setOpenSnackbar={setOpenSnackbar}/>
      <span className={'lit-info'}>
        <Tooltip placement={'left'} title="Powered by Lit Token Access">
          <IconButton>
            <InfoIcon/>
          </IconButton>
        </Tooltip>
      </span>
    </div>
  )
}

export default ShopifyRedeem;