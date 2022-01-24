import React, { useEffect, useState } from "react";
import { useAppContext } from "../../context";
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Snackbar,
  TextField,
  Tooltip
} from "@mui/material";
import { getPromotion, redeemDraftOrder, getAccessControl } from "./shopifyAsyncHelpers";
import "./ShopifyRedeem.scss";
import LitJsSdk from "lit-js-sdk";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const BASE_URL = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

const loadingStatus = {
  loading: 'Loading...',

}

const ShopifyRedeem = () => {
  const { performWithAuthSig } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);

  const [draftOrderId, setDraftOrderId] = useState(null);
  const [draftOrderDetails, setDraftOrderDetails] = useState(null);
  const [storedAuthSig, setStoredAuthSig] = useState(null);
  const [connectedToLitNodeClient, setConnectedToLitNodeClient] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);
  const [redeemUrl, setRedeemUrl] = useState(null);
  const [humanizedAccessControlConditions, setHumanizedAccessControlConditions] = useState(null);

  document.addEventListener('lit-ready', function (e) {
    setConnectedToLitNodeClient(true);
  }, false)

  useEffect(() => {
    if (!connectedToLitNodeClient) {
      connectToLitNode();
    }
    if (!draftOrderId && connectedToLitNodeClient) {
      const queryString = window.location.search;
      const queryParams = new URLSearchParams(queryString);
      const id = queryParams.get('id');
      setDraftOrderId(id);
      // window.history.replaceState(null, null, window.location.pathname);
      signIntoLit();
    }
  }, [draftOrderId, connectedToLitNodeClient])

  useEffect(() => {
    if (!!storedAuthSig) {
      redeemPromotion();
    }
  }, [storedAuthSig])

  const connectToLitNode = async () => {
    let litNodeClient = new LitJsSdk.LitNodeClient();
    await litNodeClient.connect();
    window.litNodeClient = litNodeClient;
  }

  const signIntoLit = async () => {
    await performWithAuthSig(async (authSig) => {
      if (!storedAuthSig || !storedAuthSig["sig"]) {
        console.log("Stop auth if authSig is not yet available");
      }
      setStoredAuthSig(authSig);
    })
  }

  const checkForPromotionAccessControl = async () => {
    try {
      const resp = await getAccessControl(draftOrderId);
      console.log('REPOSFNASKFLNSA', resp)
      setHumanizedAccessControlConditions(resp.data.humanizedAccessControlConditions);
      console.log('-->  Before provision access')
      // const jwt = await provisionAccess(resp.data.parsedAcc);
      return provisionAccess(resp.data.parsedAcc).then(jwt => {
        console.log('-->  After Provision access', jwt)
        return jwt;
      });
      // return jwt;
    } catch (err) {
      // ADD_ERROR_HANDLING
      setLoading(false);
      console.log('Share not found:', err)
    }
  }

  const provisionAccess = async (accessControlConditions) => {
    console.log('--> Start of provision access', accessControlConditions)
    const chain = accessControlConditions[0].chain;
    const resourceId = {
      baseUrl: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST,
      path: "/shopify/l/" + draftOrderId,
      orgId: "",
      role: "customer",
      extraData: "",
    };
    // const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain });
    console.log('--> Right before Jwt', storedAuthSig, resourceId)
    try {
      const jwt = await window.litNodeClient.getSignedToken({
        accessControlConditions: accessControlConditions,
        chain: chain,
        authSig: storedAuthSig,
        resourceId: resourceId
      });
      console.log('--> JWT', jwt)

      return jwt;
    } catch (err) {
      console.log('Error getting JWT:', err)
      return null;
    }


  }

  const redeemPromotion = async () => {
    checkForPromotionAccessControl().then(async (jwt) => {
      console.log('JWT', jwt)
      try {
        const resp = await redeemDraftOrder(draftOrderId, jwt);
        console.log('product data', resp.data);
        setProduct(resp.data.product);
        console.log('draft order info', resp.data.draftOrderDetails);
        setDraftOrderDetails(resp.data.draftOrderDetails);
        setAccessVerified(true);
        setLoading(false);
        setRedeemUrl(resp.data.redeemUrl);
        // window.location.href = resp.data.redeemUrl;
      } catch (err) {
        // ADD_ERROR_HANDLING
        setLoading(false);
        console.log('Error creating draft order:', err)
      }
    }).catch(err => {
      // ADD_ERROR_HANDLING
      setLoading(false);
      console.log('Error provisioning access:', err);
    })
  }

  const getSubmitTooltip = () => {
    if (!accessVerified) {
      return 'Please sign in to wallet.';
    } else {
      return 'Click to redeem access.';
    }
  }

  const makeSummary = () => {
    if (draftOrderDetails.value === 0) {

    }
  }

  return (
    <div className={"full-container"}>
      <div>
        <div className={'access-service-background'}/>
        <section className={'access-service-card-container'}>
          <Card className={'access-service-card'}>
            <CardContent className={'shopify-service-card-header'}>
            <span className={'access-service-card-header-left'}>
              <h1>Token Access Verification</h1>
            </span>
              <span className={'access-service-card-header-right'}>
              <a href={'https://litprotocol.com/'} target={'_blank'} rel="noreferrer"><p>Powered by<span
                className={'lit-gateway-title'}>Lit Protocol</span><OpenInNewIcon/></p></a>
            </span>
            </CardContent>
            <CardContent className={'shopify-service-card-content'}>
              <div className={"center-content"}>
                {((!storedAuthSig || !accessVerified && loading)) && (
                  <div>
                    <CircularProgress className={"spinner"}/>
                    <p>Signing in.</p>
                  </div>
                )}
                {(storedAuthSig && !accessVerified && !loading) && (
                  <div>
                    <p>Sorry, you do not qualify for this promotion.</p>
                    <p>The conditions for access were not met.</p>
                    <p>{humanizedAccessControlConditions}</p>
                  </div>
                )}
                {storedAuthSig && accessVerified && !loading &&
                !!product && !!draftOrderDetails && (
                  <div className={'product-information-container'}>
                    <div className={'product-information-left'}>
                      <img className={"product-image"} src={product.images[0].src}/>
                    </div>
                    <div className={'product-information-center'}>
                      <span className={'product-detail'}>
                        <p
                          className={'product-attribute-label'}>{draftOrderDetails.value === 0 ? `Exclusive Access` : 'Discount'}</p>
                        {draftOrderDetails.value !== 0 && (
                          <p className={'product-discount'}>{draftOrderDetails.value}% off full price</p>)}
                      </span>
                      <span className={'product-conditions'}>
                        <p className={'product-attribute-label'}>Requirement:</p>
                        <p className={'product-condition'}>{humanizedAccessControlConditions}</p>
                      </span>
                    </div>
                    <div className={'product-information-right'}>
                      <p>
                        {product.vendor} is using wallet verification to provide token-access based discounts.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardActions className={'access-service-card-actions'} style={{ padding: '0' }}>
              {storedAuthSig && accessVerified && !loading && (
                <Tooltip title={getSubmitTooltip()} placement="top">
                  <span className={"access-service-card-launch-button"} onClick={async () => {
                    window.location.href = redeemUrl;
                  }}>
                    Redeem Promotion
                    <svg width="110" height="23" viewBox="0 0 217 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0.576416 20.9961H212.076L184.076 1.99609" stroke="white" strokeWidth="3"/>
                    </svg>
                  </span>
                </Tooltip>
              )}
            </CardActions>
          </Card>
          {/*<Snackbar*/}
          {/*  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}*/}
          {/*  open={openSnackbar}*/}
          {/*  autoHideDuration={4000}*/}
          {/*  onClose={handleCloseSnackbar}*/}
          {/*>*/}
          {/*  <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>*/}
          {/*</Snackbar>*/}
        </section>
      </div>
    </div>

  )
}

export default ShopifyRedeem;
