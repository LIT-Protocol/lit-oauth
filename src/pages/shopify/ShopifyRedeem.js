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
  Select,
  MenuItem,
  Tooltip, FormControl, InputLabel
} from "@mui/material";
import { setUpRedeemDraftOrder, redeemDraftOrder, getAccessControl } from "./shopifyAsyncHelpers";
import "./ShopifyRedeem.scss";
import './ShopifyStyles.scss';
import LitJsSdk from "lit-js-sdk";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const ShopifyRedeem = () => {
  const { performWithAuthSig } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [errorText, setErrorText] = useState(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState(null);

  const [draftOrderId, setDraftOrderId] = useState(null);
  const [draftOrderDetails, setDraftOrderDetails] = useState(null);
  const [allowUserToRedeem, setAllowUserToRedeem] = useState(true);
  const [storedAuthSig, setStoredAuthSig] = useState(null);
  const [connectedToLitNodeClient, setConnectedToLitNodeClient] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);
  const [humanizedAccessControlConditions, setHumanizedAccessControlConditions] = useState(null);
  const [chain, setChain] = useState(null);

  const [selectedProductVariant, setSelectedProductVariant] = useState('');
  const [variantMenuOptions, setVariantMenuOptions] = useState('');
  const [selectedVariantMenuOption, setSelectedVariantMenuOption] = useState('');

  const [loadingDraftOrderLink, setLoadingDraftOrderLink] = useState(false);

  document.addEventListener('lit-ready', function (e) {
    console.log('lit-ready event listener')
    setConnectedToLitNodeClient(true);
  }, false)

  useEffect(() => {
    if (!connectedToLitNodeClient) {
      connectToLitNode();
    }
  }, [connectedToLitNodeClient])

  useEffect(() => {
    if (!!storedAuthSig && !accessVerified) {
      callSetUpRedeemDraftOrder();
    }
  }, [storedAuthSig])

  useEffect(() => {
    if (selectedVariantMenuOption.length) {
      const selectedVariant = product.variants.find(v => v.title === selectedVariantMenuOption)
      setSelectedProductVariant(selectedVariant);
    }
  }, [selectedVariantMenuOption])

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpenSnackbar(false);
    setSnackbarInfo(null);
  };

  const handleSetSnackbar = (message, severity) => {
    setSnackbarInfo({
      severity,
      message
    });
    console.log('check snackbarInfo', snackbarInfo)
    console.log('check severity', severity)
    console.log('check message', message)
    setOpenSnackbar(true);
  };

  const connectToLitNode = async () => {
    let litNodeClient = new LitJsSdk.LitNodeClient();
    await litNodeClient.connect();
    window.litNodeClient = litNodeClient;
    const queryString = window.location.search;
    const queryParams = new URLSearchParams(queryString);
    const id = queryParams.get('id');
    setDraftOrderId(id);
    signIntoLit();
  }

  const signIntoLit = async () => {
    try {
      await performWithAuthSig(async (authSig) => {
        console.log('check authSig', authSig)
        // if (!storedAuthSig || !storedAuthSig["sig"]) {
        //   console.log("Stop auth if authSig is not yet available");
        //   return;
        // }
        setStoredAuthSig(authSig);
      })
    } catch (err) {
      setErrorText(err);
      setLoading(false);
      console.log('Error connecting wallet:', err)
    }
  }

  const checkForPromotionAccessControl = async () => {
    try {
      console.log('Check for Promo - start')
      const resp = await getAccessControl(draftOrderId);
      console.log('Check for promo getAccessControl', resp.data);
      setHumanizedAccessControlConditions(resp.data.humanizedAccessControlConditions);
      console.log('check get Access Control resp', resp.data)
      return provisionAccess(resp.data.parsedAcc).then(jwt => {
        console.log('provision access jwt', jwt)
        return jwt;
      });
    } catch (err) {
      // ADD_ERROR_HANDLING
      setLoading(false);
      handleSetSnackbar(err, 'error');
      console.log('Share not found:', err)
    }
  }

  const provisionAccess = async (accessControlConditions) => {
    const chain = accessControlConditions?.[0]['chain'] ?? accessControlConditions?.[0][0]['chain'] ?? 'ethereum';

    setChain(chain);
    const resourceId = {
      baseUrl: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST,
      path: "/shopify/l/" + draftOrderId,
      orgId: "",
      role: "customer",
      extraData: "",
    };
    const signedTokenObj = {
      accessControlConditions: accessControlConditions,
      chain: chain,
      authSig: storedAuthSig,
      resourceId: resourceId
    }
    try {
      const jwt = await window.litNodeClient.getSignedToken({
        accessControlConditions: accessControlConditions,
        chain: chain,
        authSig: storedAuthSig,
        resourceId: resourceId
      });

      return jwt;
    } catch (err) {
      console.log('Error getting JWT:', err)
      handleSetSnackbar(err, 'error');
      return null;
    }
  }

  const formatSelectMenuOptions = (product) => {
    const mappedVariantRows = product.variants.map((p) => {
      return p.title
    })
    setVariantMenuOptions(mappedVariantRows);
  }

  const callSetUpRedeemDraftOrder = async () => {
    checkForPromotionAccessControl().then(async (jwt) => {
      try {
        const resp = await setUpRedeemDraftOrder(draftOrderId, jwt);
        setProduct(resp.data.product);
        setDraftOrderDetails(resp.data.draftOrderDetails);
        // todo: fix with redeem limit
        setAllowUserToRedeem(resp.data.allowUserToRedeem);
        formatSelectMenuOptions(resp.data.product);
        setAccessVerified(true);
        setLoading(false);
      } catch (err) {
        // ADD_ERROR_HANDLING
        setLoading(false);
        setErrorText('Something went wrong while trying to create the draft order.')
        handleSetSnackbar(err, 'error');
        console.log('Error creating draft order:', err)
      }
    }).catch(err => {
      // ADD_ERROR_HANDLING
      setLoading(false);
      handleSetSnackbar(err, 'error');
      console.log('Error provisioning access:', err);
    })
  }


  const callRedeemDraftOrder = async () => {
    setLoadingDraftOrderLink(true);
    checkForPromotionAccessControl().then(async (jwt) => {
      console.log('JWT in redeem draft order', jwt)
      try {
        const resp = await redeemDraftOrder(draftOrderId, selectedProductVariant, jwt);
        console.log('Check redeem draft order', resp.data)
        window.location.href = resp.data.redeemUrl;
        setLoading(false);
      } catch (err) {
        // ADD_ERROR_HANDLING
        setLoading(false);
        handleSetSnackbar(err, 'error');
        console.log('Error creating draft order:', err)
      }
    }).catch(err => {
      // ADD_ERROR_HANDLING
      setLoading(false);
      handleSetSnackbar(err, 'error');
      console.log('Error provisioning access:', err);
    })
  }

  const getSubmitTooltip = () => {
    if (!accessVerified) {
      return 'Please sign in to wallet.';
    } else if (!selectedProductVariant) {
      return 'Please select a product.';
    } else {
      return 'Click to redeem access.';
    }
  }

  const getRedeemButtonCondition = () => {
    if (loadingDraftOrderLink) {
      return 'Loading...'
    } else if (!selectedProductVariant) {
      return 'Select a product'
    } else if (selectedProductVariant.inventory_management === 'shopify' && selectedProductVariant.inventory_quantity === 0) {
      return 'Item is out of stock'
    } else {
      return 'Redeem promotion'
    }
  }

  return (
    <div className={"full-container"}>
      <div>
        <div className={'shopify-service-background'}/>
        <section className={'shopify-service-card-container'}>
          <Card className={'shopify-service-card'}>
            <CardContent className={'shopify-service-card-header'}>
            <span className={'shopify-service-card-header-left'}>
              <h1>Token Access Verification</h1>
            </span>
              <span className={'shopify-service-card-header-right'}>
              <a href={'https://litprotocol.com/'} target={'_blank'} rel="noreferrer"><p>Powered by<span
                className={'lit-gateway-title'}>Lit Protocol</span><OpenInNewIcon/></p></a>
            </span>
            </CardContent>
            <CardContent className={'redeem-service-card-content'}>
              <div className={"center-content"}>

                {/*loader*/}
                {((!storedAuthSig || !accessVerified) && loading) && (
                  <div>
                    <CircularProgress className={"spinner"}/>
                    <p>Signing in.</p>
                  </div>
                )}

                {/*error message if access is not verified*/}
                {(storedAuthSig && !accessVerified && !loading) && (
                  <div>
                    {/*something went wrong while connecting*/}
                    {errorText ? (
                      <div>
                        <p>There was an error.</p>
                        {/* <p>{errorText}</p> */}
                        <p>Please connect your wallet manually or click below to try again.</p>
                        <p>If you are on mobile, use the browser in the Metamask app.</p>
                        <Button onClick={() => signIntoLit()}>Click to try to reconnect.</Button>
                      </div>
                    ) : (
                      <div>
                        <p>Sorry, you do not qualify for this promotion.</p>
                        <p>The conditions for access were not met.</p>
                        <p>{!errorText ? humanizedAccessControlConditions : errorText}</p>
                        <p>{chain ? `On chain: ${chain[0].toUpperCase()}${chain.slice(1)}` : ''}</p>
                        <p>If you think this is an error, click the button below to try to reconnect.</p>
                        <Button onClick={() => signIntoLit()}>Click to try to reconnect.</Button>
                      </div>
                    )}
                  </div>
                )}

                {/*error message is user is not allowed to redeem*/}
                {!allowUserToRedeem && (
                  <div>
                    <p>It looks like you have hit the limit for number of times to redeem this offer.</p>
                    <p>If you think this is an error, reload the page to reconnect or contact the creator
                      of the offer.</p>
                    {/*<Button onClick={() => signIntoLit()}>Click to try to reconnect.</Button>*/}
                  </div>
                )}

                {/*show product info*/}
                {storedAuthSig && accessVerified && !loading && allowUserToRedeem &&
                !!product && !!draftOrderDetails && (
                  <div className={'product-information-container'}>
                    <div className={'product-information-left'}>
                      {(!!product['images'] && !!product['images'].length && !!product.images['0']['src']) ? (
                        <img className={"product-image"} src={product.images[0].src}/>
                      ) : (
                        <div className={"no-product-image"}>No image available</div>
                      )}
                    </div>
                    <div className={'product-information-right'}>
                      <div className={'product-detail'}>
                        <p
                          className={'product-attribute-label'}>{draftOrderDetails.value === 0 ? `Exclusive Access` : 'Discount'}</p>
                        {draftOrderDetails.value !== 0 && (
                          <p className={'product-light'}>{draftOrderDetails.value}% off full price</p>)}
                      </div>
                      {product.title && (
                        <span className={'product-conditions'}>
                          <p className={'product-attribute-label'}>Title:</p>
                          <p className={'product-condition'}>{product.title}</p>
                        </span>
                      )}
                      <div className={'product-conditions'}>
                        <p className={'product-attribute-label'}>Requirement:</p>
                        <p className={'product-condition'}>{humanizedAccessControlConditions}</p>
                      </div>
                      {!!variantMenuOptions && (
                        <FormControl fullWidth>
                          <InputLabel>Select a product</InputLabel>
                          <Select value={selectedVariantMenuOption}
                                  className={'product-variant-select'}
                                  label={'Select a product'}
                                  onChange={(e) => {
                                    console.log('setSelectedVariantMenuOption', e.target.value);
                                    setSelectedVariantMenuOption(e.target.value)
                                  }}
                          >
                            {variantMenuOptions.map((v, i) => (
                              <MenuItem key={i} value={v}>{product.title} - {v}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </div>
                    {/*  <div className={'product-information-right'}>*/}
                    {/*    <p>*/}
                    {/*      {product.vendor} is using wallet verification to provide token-access based discounts.*/}
                    {/*    </p>*/}
                    {/*  </div>*/}
                  </div>
                )}
              </div>
            </CardContent>
            <CardActions className={'redeem-card-actions'} style={{ padding: '0' }}>
              {storedAuthSig && accessVerified && !loading && allowUserToRedeem && (
                <Tooltip title={getSubmitTooltip()} placement="top">
                  {/*<span className={"access-service-card-launch-button"} onClick={async () => {*/}
                  <div>
                    <Button
                      disabled={!selectedProductVariant || (selectedProductVariant.inventory_management === 'shopify' && selectedProductVariant.inventory_quantity === 0)}
                      variant={"contained"}
                      className={"redeem-button"}
                      onClick={async () => {
                        await callRedeemDraftOrder()
                      }}>
                      {getRedeemButtonCondition()}
                      {/*<svg width="110" height="23" viewBox="0 0 217 23" fill="none" xmlns="http://www.w3.org/2000/svg">*/}
                      {/*  <path d="M0.576416 20.9961H212.076L184.076 1.99609" stroke="white" strokeWidth="3"/>*/}
                      {/*</svg>*/}
                    </Button>
                  </div>
                </Tooltip>
              )}
            </CardActions>
          </Card>
          <span className={'shopify-service-card-mobile'}>
                  <h1>Token Access Verification</h1>
                  <a href={'https://litprotocol.com/'} target={'_blank'} rel="noreferrer"><p>Powered by<span
                    className={'lit-gateway-title'}>Lit Protocol</span><OpenInNewIcon className={'open-icon'}/></p></a>
                  </span>
          {/*{!!snackbarInfo && (*/}
          {/*  <Snackbar*/}
          {/*    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}*/}
          {/*    open={openSnackbar}*/}
          {/*    autoHideDuration={4000}*/}
          {/*    onClose={handleCloseSnackbar}*/}
          {/*  >*/}
          {/*    <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>*/}
          {/*  </Snackbar>*/}
          {/*)}*/}
        </section>
      </div>
    </div>

  )
}

export default ShopifyRedeem;
