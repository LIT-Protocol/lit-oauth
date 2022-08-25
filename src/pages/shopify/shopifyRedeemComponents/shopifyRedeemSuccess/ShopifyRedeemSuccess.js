import React, { Fragment, useEffect, useState } from "react";
import ShopifyProductSelect from "../shopifyProductSelect/ShopifyProductSelect.js";
import './ShopifyRedeemSuccess.css';
import {
  Button,
  Card,
  CardActions,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle, useMediaQuery, useTheme,
} from "@mui/material";
import { redeemOfferAndUpdateUserStats } from "../shopifyRedeemApi.js";
import { LoadingButton } from "@mui/lab";

const ShopifyRedeemSuccess = ({
                                offerData,
                                offerProducts,
                                currentJwt,
                                validityResponse,
                                storedEVMAuthSig = null,
                                storedSolanaAuthSig = null,
                                toggleRedeemFailure,
                                preselectedVariant,
                                setShowRedeemFailure
                              }) => {
  const [ selectedVariantsArray, setSelectedVariantsArray ] = useState([]);
  const [ redeemButtonIsDisabled, setRedeemButtonIsDisabled ] = useState(true);
  const [ selectedNft, setSelectedNft ] = useState({});
  const [ showSelectNftDialog, setShowSelectNftDialog ] = useState(false);
  const [ sortedValidityResponse, setSortedValidityResponse ] = useState([]);
  const [ redeemLoader, setRedeemLoader ] = useState(false);
  const [ redeemLink, setRedeemLink ] = useState(null);
  const [ draftOrderDetails, setDraftOrderDetails ] = useState(null);
  const [ redeemLinkCopied, setRedeemLinkCopied ] = useState(false);

  const theme = useTheme();
  const pickNftDialogSize = useMediaQuery(theme.breakpoints.down('xl'))

  useEffect(() => {
    const initialVariants = offerProducts.map(p => {
      return {};
    });
    setSelectedVariantsArray(initialVariants);
    setDraftOrderDetails(JSON.parse(offerData.draftOrderDetails));
  }, []);

  useEffect(() => {
    // sort nfts with usable ones on top and previously redeemed ones on bottom
    const validityResponseHolder = [];
    if (validityResponse['evaluatedNfts']) {
      validityResponse.evaluatedNfts.forEach(v => {
        if (v.canRedeem) {
          validityResponseHolder.unshift(v);
        } else {
          validityResponseHolder.push(v);
        }
      })
      setSortedValidityResponse(validityResponseHolder);
    }
  }, [ validityResponse ])

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

  const convertHexToDecimal = (tokenId) => {
    const tokenIdHolder = tokenId.slice(2);
    const parsedTokenId = parseInt(tokenIdHolder, 16);
    return parsedTokenId;
  }

  const cueRedeemOffer = async () => {
    if (validityResponse['evaluatedNfts']) {
      setShowSelectNftDialog(true);
    } else {
      await redeemOffer();
    }
  }

  const redeemOffer = async () => {
    setRedeemLoader(true);
    const redeemOfferObj = {
      jwt: currentJwt,
      selectedVariantsArray,
      uuid: offerData.id,
      selectedNft,
      authSig: {
        ethereum: storedEVMAuthSig,
        solana: storedSolanaAuthSig
      }
    }
    setShowSelectNftDialog(false);
    try {
      const redeemOfferRes = await redeemOfferAndUpdateUserStats(redeemOfferObj);
      console.log('redeemOfferRes', redeemOfferRes)
      if (!draftOrderDetails.hasRedeemLimit) {
        window.location.href = redeemOfferRes.data.redeemUrl;
      } else {
        if (redeemOfferRes.data.hasOwnProperty('allowRedeem') && redeemOfferRes.data['allowRedeem'] === false) {
          console.log('DISALLOW REDEEM')
          toggleRedeemFailure('Error checking offer validity', redeemOfferRes.data.message, '');
          setShowRedeemFailure(true);
        } else {
          setRedeemLink(redeemOfferRes.data.redeemUrl);
          setRedeemLoader(false);
        }
      }
    } catch (err) {
      console.log('Error redeeming offer:', err);
      toggleRedeemFailure('There was an error redeeming the offer', [], err)
    }
  }

  const getNftCardClass = (n) => {
    if (selectedNft['nft'] &&
      n?.nft?.contract?.address === selectedNft?.nft?.contract?.address &&
      n.nft.id.tokenId === selectedNft.nft.id.tokenId) {
      return 'select-nft-card selected-nft-card';
    } else {
      return 'select-nft-card';
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
          {offerProducts.map((product, i) => {
              return (
                <ShopifyProductSelect key={i}
                                      product={product}
                                      index={i}
                                      disableSelect={!!redeemLink}
                                      selectedVariantsArray={selectedVariantsArray}
                                      preselectedVariant={preselectedVariant}
                                      updateSelectedVariant={updateSelectedVariant}></ShopifyProductSelect>
              )
            }
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
      {!!sortedValidityResponse.length && (
        <Dialog className={'select-nft-dialog'} maxWidth={'xl'} fullScreen={pickNftDialogSize}
                open={showSelectNftDialog}>
          <DialogTitle>Which NFT would you like to use to redeem this
            offer?</DialogTitle>
          <DialogContent className={'select-nft-content'}>
            <div>
              {sortedValidityResponse.map((n, i) => {
                if (n.canRedeem) {
                  return (
                    <span key={i} className={getNftCardClass(n)} onClick={() => setSelectedNft(n)}>
                      <img className={'select-nft-image'} src={n.nft.metadata.image}/>
                      <div className={'select-nft-info'}>
                        <h3 className={'select-nft-title'}>{n.nft.title}</h3>
                        <p>Address: {n.nft.contract.address}</p>
                        <p>TokenID: {convertHexToDecimal(n.nft.id.tokenId)}</p>
                      </div>
                    </span>
                  )
                } else {
                  return (
                    <span key={i} className={'select-nft-card select-nft-card-disabled'}>
                      <img className={'select-nft-image'} src={n.nft.metadata.image}/>
                      <div className={'select-nft-info'}>
                        <h3 className={'select-nft-already-redeemed'}>- Has already been redeemed -</h3>
                        <h3 className={'select-nft-title'}>{n.nft.title}</h3>
                        <p>Address: {n.nft.contract.address}</p>
                        <p>TokenID: {convertHexToDecimal(n.nft.id.tokenId)}</p>
                      </div>
                    </span>
                  )
                }
              })}
            </div>
          </DialogContent>
          <DialogActions>
            <span className={'select-nft-dialog-actions'}>
              <Button variant={'contained'}
                      onClick={() => {
                        setSelectedNft({});
                        setShowSelectNftDialog(false);
                      }}>Go back</Button>
              <Button variant={'contained'} disabled={!selectedNft['nft']}
                      onClick={() => redeemOffer()}>
                Confirm NFT and redeem offer
              </Button>
            </span>
          </DialogActions>
        </Dialog>
      )}
    </Fragment>
  )
}

export default ShopifyRedeemSuccess;