import React, { Fragment, useEffect, useState } from "react";
import { useAppContext } from "../../context";
import {
  Alert,
  Button,
  CardActions,
  Snackbar,
  Select,
  MenuItem,
  Tooltip, FormControl, InputLabel, LinearProgress
} from "@mui/material";
import { setUpRedeemDraftOrder, redeemDraftOrder, getAccessControl } from "./shopifyAsyncHelpers";
import "./ShopifyRedeem.scss";
import './ShopifyStyles.scss';
import LitJsSdk from "lit-js-sdk";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { updateV1ConditionTypes } from "./shopifyHelpers";

const ShopifyRedeem = () => {
  const {performWithAuthSig} = useAppContext();
  const [ loading, setLoading ] = useState(true);
  const [ product, setProduct ] = useState(null);
  const [ errorText, setErrorText ] = useState(null);
  const [ openSnackbar, setOpenSnackbar ] = useState(false);
  const [ snackbarInfo, setSnackbarInfo ] = useState(null);

  const [ accessControlData, setAccessControlData ] = useState(null);
  const [ draftOrderId, setDraftOrderId ] = useState(null);
  const [ draftOrderDetails, setDraftOrderDetails ] = useState(null);
  const [ allowUserToRedeem, setAllowUserToRedeem ] = useState(true);
  const [ storedEVMAuthSig, setStoredEVMAuthSig ] = useState(null);
  const [ storedSolanaAuthSig, setStoredSolanaAuthSig ] = useState(null);
  const [ connectedToLitNodeClient, setConnectedToLitNodeClient ] = useState(false);
  const [ accessVerified, setAccessVerified ] = useState(false);
  const [ humanizedAccessControlConditions, setHumanizedAccessControlConditions ] = useState(null);
  const [ redemptionURL, setRedemptionURL ] = useState(null);
  const [ linkCopied, setLinkCopied ] = useState(false);

  const [ selectedProductVariant, setSelectedProductVariant ] = useState('');
  const [ variantMenuOptions, setVariantMenuOptions ] = useState('');
  const [ selectedVariantMenuOption, setSelectedVariantMenuOption ] = useState('');

  const [ loadingDraftOrderLink, setLoadingDraftOrderLink ] = useState(false);

  document.addEventListener('lit-ready', function (e) {
    console.log('lit-ready event listener')
    setConnectedToLitNodeClient(true);
  }, false);

  useEffect(() => {
    if (!connectedToLitNodeClient) {
      connectToLitNode();
    }
  }, [ connectedToLitNodeClient ]);

  useEffect(() => {
    if (!accessVerified && (storedSolanaAuthSig || storedEVMAuthSig)) {
      callSetUpRedeemDraftOrder();
    }
  }, [ accessVerified, storedSolanaAuthSig, storedEVMAuthSig ]);

  useEffect(() => {
    if (selectedVariantMenuOption.length) {
      const selectedVariant = product.variants.find(v => v.title === selectedVariantMenuOption)
      setSelectedProductVariant(selectedVariant);
    }
  }, [ selectedVariantMenuOption ]);

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpenSnackbar(false);
    setSnackbarInfo(null);
  };

  const handleUpdateError = (error) => {
    console.log('error.message', error.message);
    setErrorText(error.message);
  };

  const handleSetSnackbar = (error, severity) => {
    const snackbarInfoHolder = {
      message: error.message,
      severity: severity
    };
    setSnackbarInfo(snackbarInfoHolder);
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
    try {
      const resp = await getAccessControl(id);
      setAccessControlData(resp.data);
      setHumanizedAccessControlConditions(resp.data.humanizedAccessControlConditions);
      getAuthSigs(resp.data.extraData);
    } catch (err) {
      console.log('Error getting access control', err);
      handleUpdateError(err);
    }
  }

  const getAuthSigs = async (chainString) => {
    // todo: remove eventually. this loads the EVM signature for obsolete condition types that don't have a chain string
    if (!chainString) {
      await getEVMAuthSig();
    } else {
      const chainArray = chainString.split(',');
      chainArray.forEach(c => {
        // todo: will need to update this as some point to describe EVM chains as something better than 'not solRpc'
        if (c !== 'solRpc') {
          getEVMAuthSig();
        } else if (c === 'solRpc') {
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
      handleUpdateError(`${err.message} - Make sure you are signed in to Metamask.`);
      setLoading(false);
    }
  }

  const getSolanaAuthSig = async () => {
    try {
      await performWithAuthSig(async (authSig) => {
        setStoredSolanaAuthSig(authSig);
      }, {chain: 'solana'})
    } catch (err) {
      handleUpdateError(`${err.message} - Make sure you are signed in to Phantom.`);
      setLoading(false);
    }
  }

  const checkForPromotionAccessControl = async () => {
    try {
      return provisionAccess(accessControlData.parsedAcc).then(jwt => {
        return jwt;
      });
    } catch (err) {
      // ADD_ERROR_HANDLING
      setLoading(false);
      // handleSetSnackbar(err, 'error');
      setAccessVerified(false);
      handleUpdateError(err);
      console.log('Share not found:', err)
    }
  }

  const provisionAccess = async (unifiedAccessControlConditions) => {
    let chainArray;
    let authSigs = {};
    // for obsolete access control conditions where extraData was null
    if (!accessControlData['extraData']) {
      authSigs['ethereum'] = storedEVMAuthSig;
    } else {
      chainArray = accessControlData.extraData.split(',');
      chainArray.forEach(c => {
        // if (c === 'evmBasic' || c === 'ethereum') {
        if (c !== 'solRpc') {
          authSigs['ethereum'] = storedEVMAuthSig;
        } else if (c === 'solRpc') {
          authSigs['solana'] = storedSolanaAuthSig;
        }
      });
    }
    console.log('unifiedAccessControlConditions', unifiedAccessControlConditions)

    // const getWalletNFTsResponse = await getWalletNFTs(authSigs, unifiedAccessControlConditions);

    const resourceId = {
      baseUrl: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST,
      path: "/shopify/l/" + draftOrderId,
      orgId: "",
      role: "customer",
      extraData: "",
    };

    const afterUpdateV1Conditions = updateV1ConditionTypes(unifiedAccessControlConditions);

    try {
      const jwt = await window.litNodeClient.getSignedToken({
        unifiedAccessControlConditions: afterUpdateV1Conditions,
        authSig: authSigs,
        resourceId: resourceId
      });

      return jwt;
    } catch (err) {
      console.log('Error getting JWT:', err)
      handleUpdateError(err);
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
        console.log('draft order details', resp.data)
        // todo: fix with redeem limit
        setAllowUserToRedeem(resp.data.allowUserToRedeem);
        formatSelectMenuOptions(resp.data.product);
        setAccessVerified(true);
        setLoading(false);
        console.log('product', resp.data.product);
      } catch (err) {
        // ADD_ERROR_HANDLING
        setLoading(false);
        setErrorText('Something went wrong while trying to create the draft order.')
        // handleSetSnackbar(err, 'error');
        console.log('check error', err)
        handleUpdateError(err);
        console.log('Error creating draft order:', err)
      }
    }).catch(err => {
      // ADD_ERROR_HANDLING
      setLoading(false);
      // handleSetSnackbar(err, 'error');
      handleUpdateError(err);
      console.log('Error provisioning access:', err);
    })
  }

  const callRedeemDraftOrder = async () => {
    setLoadingDraftOrderLink(true);
    checkForPromotionAccessControl().then(async (jwt) => {
      try {
        const resp = await redeemDraftOrder(draftOrderId, selectedProductVariant, jwt);
        if (!draftOrderDetails.redeemLimit || draftOrderDetails.redeemLimit == 0) {
          window.location.href = resp.data.redeemUrl;
        } else {
          setRedemptionURL(resp.data.redeemUrl);
        }
        setLoading(false);
      } catch (err) {
        // ADD_ERROR_HANDLING
        setLoading(false);
        // handleSetSnackbar(err, 'error');
        handleUpdateError(err);
        console.log('Error creating draft order:', err)
      }
    }).catch(err => {
      // ADD_ERROR_HANDLING
      setLoading(false);
      // handleSetSnackbar(err, 'error');
      handleUpdateError(err);
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
      return 'Loading...';
    } else if (!selectedProductVariant) {
      return 'Select a product';
    } else if (selectedProductVariant.inventory_management === 'shopify' && selectedProductVariant.inventory_quantity === 0) {
      return 'Item is out of stock';
    } else {
      return 'Redeem promotion';
    }
  }

  return (
    <div className={"full-container"}>
      <section className={'shopify-service-card-container'}>
        <div className={'shopify-service-card'}>
          <div className={'shopify-service-card-header'}>
              <span className={'shopify-service-card-header-left'}>
                <h1>Token Access Verification</h1>
              </span>
            <span className={'shopify-service-card-header-right'}>
                <a href={'https://apps.shopify.com/lit-token-access'} target={'_blank'}
                   rel="noreferrer"><p>Powered by<span
                  className={'lit-gateway-title'}>Lit Token Access</span><OpenInNewIcon fontSize={'small'}/></p></a>
              </span>
          </div>

          {/*loader*/}
          {(((!storedEVMAuthSig && !storedSolanaAuthSig) || !accessVerified) && loading) && (
            <div className={'shopify-service-card-content'}>
              <p>Signing in.</p>
              {/*{`storedEVM ${!!storedEVMAuthSig}, accessVerified ${!accessVerified}, loading ${loading}`}*/}
              <LinearProgress color={"primary"} className={'.shopify-service-card-loader'}/>
              <p>If this loader doesn't resolve, try signing in to your wallet manually and reloading the page.</p>
            </div>
          )}

          {/*error message if access is not verified*/}
          {(!accessVerified && !loading) && (
            <div className={'redeem-card-error'}>
              {/*something went wrong while connecting*/}
              {!!errorText ? (
                <div>
                  <p>Sorry, you do not qualify for this promotion.</p>
                  <p>The conditions for access were not met.</p>
                  <p>{humanizedAccessControlConditions}</p>
                  {/*<p>{chain ? `On chain: ${chain[0].toUpperCase()}${chain.slice(1)}` : ''}</p>*/}
                  <p>If you think this is an error, contact the creator of the offer or click the button below to try to
                    reconnect.</p>
                  <Button onClick={() => getAuthSigs()}>Click to try to reconnect.</Button>
                </div>
              ) : (
                <div>
                  <p>There was an error.</p>
                  {/* <p>{errorText}</p> */}
                  <p>Please connect your wallet manually or click below to try again.</p>
                  <p>If you are on mobile, use the browser in the Metamask app.</p>
                  <Button onClick={() => getAuthSigs()}>Click to try to reconnect.</Button>
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
              {/*<Button onClick={() => getAuthSigs()}>Click to try to reconnect.</Button>*/}
            </div>
          )}

          {/*show product info*/}
          {(storedEVMAuthSig || storedSolanaAuthSig) && accessVerified && !loading && allowUserToRedeem &&
            !!product && !!draftOrderDetails && (
              <div className={'product-information-container fadeIn'}>
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
              </div>
            )}
          <CardActions className={'redeem-card-actions'} style={{padding: '0'}}>
            {(storedEVMAuthSig || storedSolanaAuthSig) && accessVerified && !loading && allowUserToRedeem && (
              <Fragment>
                {!redemptionURL ? (
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
                      </Button>
                    </div>
                  </Tooltip>
                ) : (
                  <span>
                    <p className={'redemptionUrl-prompt'}>
                      <strong>NOTICE:</strong> There is a limit on how many times this offer can be redeemed. Use the button to the right to copy the link and paste it into a new window, but make sure to save it if you don't checkout immediately.  You might not be able to access it again if you don't.
                    </p>
                    <Button className={"redeem-button"}
                            variant={"contained"}
                            onClick={async () => {
                              navigator.clipboard.writeText(redemptionURL);
                              setLinkCopied(true);
                              // window.location.href = redemptionURL;
                            }}>
                      {!linkCopied ? 'Click to copy checkout link' : 'Copied!'}
                    </Button>
                  </span>
                )}
              </Fragment>
            )}
          </CardActions>
        </div>
      </section>
      {!!snackbarInfo && (
        <Snackbar
          anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
          open={openSnackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
        </Snackbar>
      )}
    </div>

  )
}

export default ShopifyRedeem;