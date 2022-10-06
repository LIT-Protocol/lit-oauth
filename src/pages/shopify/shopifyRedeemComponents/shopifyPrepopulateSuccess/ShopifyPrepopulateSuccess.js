import ShopifySnackbar from "../ShopifySnackbar.js";
import {
  Button,
  Card,
  CardActions,
  useMediaQuery,
  useTheme
} from "@mui/material";
import React, { Fragment, useEffect, useState } from "react";
import { LoadingButton } from "@mui/lab";
import { getPrepopulateInfo, redeemOfferAndUpdateUserStats, redeemPrepopulate } from "../shopifyRedeemApi.js";
import './ShopifyPrepopulateSuccess.css';
import ShopifyPrepopulateProductSelect from "../shopifyPrepopulateProductSelect/ShopifyPrepopulateProductSelect.js";

function ShopifyPrepopulateSuccess({
                                     offerData,
                                     offerProducts,
                                     currentJwt,
                                     validityResponse,
                                     storedEVMAuthSig = null,
                                     storedSolanaAuthSig = null,
                                     toggleRedeemFailure,
                                     preselectedVariant,
                                     setShowRedeemFailure
                                   }) {
  const [ selectedVariantsArray, setSelectedVariantsArray ] = useState([]);
  const [ redeemButtonIsDisabled, setRedeemButtonIsDisabled ] = useState(true);
  const [ selectedNft, setSelectedNft ] = useState({});
  const [ showSelectNftDialog, setShowSelectNftDialog ] = useState(false);
  const [ sortedValidityResponse, setSortedValidityResponse ] = useState([]);
  const [ redeemLoader, setRedeemLoader ] = useState(false);
  const [ redeemLink, setRedeemLink ] = useState(null);
  const [ draftOrderDetails, setDraftOrderDetails ] = useState(null);
  const [ redeemLinkCopied, setRedeemLinkCopied ] = useState(false);

  // const [ refreshTime, setRefreshTime ] = useState(null);
  const [ prepopulateStatus, setPrepopulateStatus ] = useState(null);
  const [ overallStatus, setOverallStatus ] = useState('loading');
  const theme = useTheme();
  const pickNftDialogSize = useMediaQuery(theme.breakpoints.down('xl'))

  useEffect(() => {
    console.log('offerData', offerData)
    toggleGetPrepopulateInfo();
  }, [])

  const toggleGetPrepopulateInfo = async () => {
    setPrepopulateStatus(null);
    // const currentTime = DateTime.now().toLocaleString(DateTime.TIME_24_WITH_SECONDS);
    // setRefreshTime(currentTime);
    console.log('Offer products', offerProducts)

    console.log('currentJwt', currentJwt)
    try {
      const prepopulateInfoHolder = await getPrepopulateInfo({
        uuid: offerData.id,
        jwt: currentJwt
      });
      setOverallStatus(prepopulateInfoHolder.data.status);
      setPrepopulateStatus(prepopulateInfoHolder.data);
      console.log('prepopulateInfo', prepopulateInfoHolder.data)
    } catch (err) {
      console.log('Error getting prepopulate data:', err);
    }
  }

  const updateSelectedVariant = (variant, index) => {
    // update product variant
    const selectedVariantsArrayHolder = selectedVariantsArray;
    const variantHolder = variant;
    variantHolder.productTitle = offerProducts[index].title;
    variantHolder.productId = offerProducts[index].id;
    selectedVariantsArrayHolder[index] = variantHolder;

    setSelectedVariantsArray(selectedVariantsArrayHolder);

    // iterate through variants and enable or disable redeem button
    let disabled = false;
    selectedVariantsArray.forEach(v => {
      if (!v.id) {
        disabled = true;
      }
    })
    setRedeemButtonIsDisabled(disabled);
  }

  const cueRedeemOffer = async () => {
    await redeemOffer();
  }

  const redeemOffer = async () => {
    setRedeemLoader(true);
    const redeemOfferObj = {
      jwt: currentJwt,
      selectedVariantsArray,
      draftOrderId: offerData.id,
      selectedNft: null,
      authSig: {
        ethereum: storedEVMAuthSig,
        solana: storedSolanaAuthSig
      }
    }
    setShowSelectNftDialog(false);
    try {
      const redeemOfferRes = await redeemPrepopulate(redeemOfferObj);
      console.log('redeemOfferRes', redeemOfferRes)
      // if (!draftOrderDetails.hasRedeemLimit) {
      window.location.href = redeemOfferRes.data.redeemUrl;
      // } else {
      //   if (redeemOfferRes.data.hasOwnProperty('allowRedeem') && redeemOfferRes.data['allowRedeem'] === false) {
      //     toggleRedeemFailure('Error checking offer validity', redeemOfferRes.data.message, '');
      //     setShowRedeemFailure(true);
      //   } else {
      // setRedeemLink(redeemOfferRes.data.redeemUrl);
      // setRedeemLoader(false);
      //   }
      // }
    } catch (err) {
      console.log('Error redeeming offer:', err);
      toggleRedeemFailure('There was an error redeeming the offer', [], err)
    }
  }


  return (
    <Fragment>
      <Card className={'redeem-success-container'}>
        <span className={'offer-info'}>
          <h1 className={'offer-info-title'}>{offerData.title}</h1>
          {!!offerData.description.length && (
            <h3>{offerData.description}</h3>
          )}
          <p>{offerData.humanizedAccessControlConditions}</p>
          <p>Type of offer: {offerData.offerType}</p>
          <p>Included items: {offerData.assetNameOnService}</p>
          <p className={'offer-container-prompt'}>Select products below to redeem</p>
        </span>
        <span className={'product-redeem-cards'}>
          {!!prepopulateStatus && (
            <ShopifyPrepopulateProductSelect product={offerProducts[0]}
                                             index={0}
                                             disableSelect={!!redeemLink}
                                             selectedVariantsArray={selectedVariantsArray}
                                             preselectedVariant={preselectedVariant}
                                             prepopulateStatus={prepopulateStatus}
                                             updateSelectedVariant={updateSelectedVariant}>
            </ShopifyPrepopulateProductSelect>
          )}
        </span>
        <CardActions>
          {!redeemLink ? (
            <span className={'offer-actions'}>
              <LoadingButton className={'offer-actions-redeem-offer-button'}
                             disabled={redeemButtonIsDisabled}
                             variant={'contained'}
                             loading={redeemLoader}
                             onClick={cueRedeemOffer}>Redeem Offer</LoadingButton>
            </span>
          ) : (
            <span className={'offer-actions-redeemed'}>
              <span className={'offer-actions-button-holder'}>
                <Button className={'offer-actions-button'}
                        variant={'contained'}
                        onClick={() => {
                          window.location.href = redeemLink;
                        }}>
                  Go to checkout
                </Button>
                <Button className={'offer-actions-button'}
                        variant={'contained'}
                        onClick={() => {
                          navigator.clipboard.writeText(redeemLink)
                          setRedeemLinkCopied(true);
                        }}>
                  {redeemLinkCopied ? 'Copied!' : 'Copy Checkout Link'}
                </Button>
              </span>
              <p className={'offer-actions-notice'}>
                <strong>NOTICE:</strong> There is a limit on how many times this offer can be redeemed. If you don't plan on checking out immediately, use the button above to copy and save the link. You might not be able to access it again if you don't.
              </p>
            </span>
          )}
        </CardActions>
      </Card>
      {/*{!!sortedValidityResponse.length && (*/}
      {/*  <Dialog className={'select-nft-dialog'} maxWidth={'xl'} fullScreen={pickNftDialogSize}*/}
      {/*          open={showSelectNftDialog}>*/}
      {/*    <DialogTitle>Which NFT would you like to use to redeem this*/}
      {/*      offer?</DialogTitle>*/}
      {/*    <DialogContent className={'select-nft-content'}>*/}
      {/*      <div>*/}
      {/*        {sortedValidityResponse.map((n, i) => {*/}
      {/*          if (n.canRedeem) {*/}
      {/*            return (*/}
      {/*              <span key={i} className={getNftCardClass(n)} onClick={() => setSelectedNft(n)}>*/}
      {/*                <img className={'select-nft-image'} src={n.nft.metadata.image}/>*/}
      {/*                <div className={'select-nft-info'}>*/}
      {/*                  <h3 className={'select-nft-title'}>{n.nft.title}</h3>*/}
      {/*                  <p>Address: {n.nft.contract.address}</p>*/}
      {/*                  <p>TokenID: {convertHexToDecimal(n.nft.id.tokenId)}</p>*/}
      {/*                </div>*/}
      {/*              </span>*/}
      {/*            )*/}
      {/*          } else {*/}
      {/*            return (*/}
      {/*              <span key={i} className={'select-nft-card select-nft-card-disabled'}>*/}
      {/*                <img className={'select-nft-image'} src={n.nft.metadata.image}/>*/}
      {/*                <div className={'select-nft-info'}>*/}
      {/*                  <h3 className={'select-nft-already-redeemed'}>- Has already been redeemed -</h3>*/}
      {/*                  <h3 className={'select-nft-title'}>{n.nft.title}</h3>*/}
      {/*                  <p>Address: {n.nft.contract.address}</p>*/}
      {/*                  <p>TokenID: {convertHexToDecimal(n.nft.id.tokenId)}</p>*/}
      {/*                </div>*/}
      {/*              </span>*/}
      {/*            )*/}
      {/*          }*/}
      {/*        })}*/}
      {/*      </div>*/}
      {/*    </DialogContent>*/}
      {/*    <DialogActions>*/}
      {/*      <span className={'select-nft-dialog-actions'}>*/}
      {/*        <Button variant={'contained'}*/}
      {/*                onClick={() => {*/}
      {/*                  setSelectedNft({});*/}
      {/*                  setShowSelectNftDialog(false);*/}
      {/*                }}>Go back</Button>*/}
      {/*        <Button variant={'contained'} disabled={!selectedNft['nft']}*/}
      {/*                onClick={() => redeemOffer()}>*/}
      {/*          Confirm NFT and redeem offer*/}
      {/*        </Button>*/}
      {/*      </span>*/}
      {/*    </DialogActions>*/}
      {/*  </Dialog>*/}
      {/*)}*/}
    </Fragment>
  )
}

export default ShopifyPrepopulateSuccess;