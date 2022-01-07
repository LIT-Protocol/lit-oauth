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
  const [draftOrder, setDraftOrder] = useState(null);
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
      const jwt = await provisionAccess(resp.data.parsedAcc);
      return jwt;
    } catch (err) {
      // ADD_ERROR_HANDLING
      setLoading(false);
      console.log('Share not found:', err)
    }
  }

  const provisionAccess = async (accessControlConditions) => {
    const chain = accessControlConditions[0].chain;
    const resourceId = {
      baseUrl: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST,
      path: "/shopify/l/" + draftOrderId,
      orgId: "",
      role: "customer",
      extraData: "",
    };
    const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain });
    const jwt = await window.litNodeClient.getSignedToken({
      accessControlConditions: Array.from(accessControlConditions),
      chain: chain,
      authSig: authSig,
      resourceId: resourceId
    });

    return jwt;
  }

  const redeemPromotion = async () => {
    checkForPromotionAccessControl().then(async (jwt) => {
      try {
        console.log('JWT', jwt)
        const resp = await redeemDraftOrder(draftOrderId, jwt);
        console.log('DO resp', resp)
        setProduct(resp.data.product);
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

  return (
    <div className={"full-container"}>
      {/*<Card className={"shopify-redeem-container"}>*/}
      {/*  <span className={'logo-container'}>*/}
      {/*    <img className={"shopify-logo"} src={'/shopifyLogo.svg'}/>*/}
      {/*    <h1 className={"logo-plus"}>+</h1>*/}
      {/*    <img className={"lit-logo"} src={'/appslogo.svg'}/>*/}
      {/*  </span>*/}
      {/*  {((!storedAuthSig || !accessVerified && loading)) && (*/}
      {/*    <div>*/}
      {/*      <CircularProgress className={"spinner"}/>*/}
      {/*      <p>Signing in.</p>*/}
      {/*    </div>*/}
      {/*  )}*/}
      {/*  {(storedAuthSig && !accessVerified && !loading) && (*/}
      {/*    <div>*/}
      {/*      <p>Sorry, you do not qualify for this promotion.</p>*/}
      {/*      <p>The conditions for access were not met.</p>*/}
      {/*      <p>{humanizedAccessControlConditions}</p>*/}
      {/*    </div>*/}
      {/*  )}*/}
      {/*  {storedAuthSig && accessVerified && !loading && (*/}
      {/*    <div>*/}
      {/*      {!!product && product.images[0].src && (*/}
      {/*        <img className={"product-image"} src={product.images[0].src}/>*/}
      {/*      )}*/}
      {/*      <p>You qualify!</p>*/}
      {/*      <Button onClick={() => redeemPromotion()}>Click to redeem</Button>*/}
      {/*    </div>*/}
      {/*  )}*/}
      {/*</Card>*/}
      <div>
        <div className={'access-service-background'}/>
        <section className={'access-service-card-container'}>
          <Card className={'access-service-card'}>
            <CardContent className={'access-service-card-header'}>
            <span className={'access-service-card-header-left'}>
                {/*<span className={'logo-container'}>*/}
              {/*  <img className={"shopify-logo"} src={'/shopifyLogo.svg'}/>*/}
              {/*  <h1 className={"logo-plus"}>+</h1>*/}
              {/*  <img className={"lit-logo"} src={'/appslogo.svg'}/>*/}
              {/*</span>*/}
              <div style={{ backgroundImage: `url('/appslogo.svg')` }} className={'access-service-card-logo'}/>
              <div className={'access-service-card-title'}>
                <h2>Lit Apps</h2>
                <p>The power of blockchain-defined access combine with your current tool suite.</p>
              </div>
            </span>
              <span className={'access-service-card-header-right'}>
                <a href={'https://litgateway.com/'} target={'_blank'}><p>Find more apps on the<strong
                  className={'lit-gateway-title'}>Lit Gateway</strong><OpenInNewIcon/></p></a>
            </span>
            </CardContent>
            <CardContent className={'access-service-card-content'}>

              {/*OLD mark*/}
              {/*{!!product && product.images[0].src && (*/}
              {/*  <img className={"product-image"} src={product.images[0].src}/>*/}
              {/*)}*/}
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
                {storedAuthSig && accessVerified && !loading && (
                  <div>
                    <p>You qualify!</p>
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