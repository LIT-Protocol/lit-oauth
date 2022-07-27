import React, { useEffect, useState } from "react";
import ShopifyProductSelect from "../shopifyProductSelect/ShopifyProductSelect.js";
import './ShopifyRedeemSuccess.css';
import { Button, Card, CardActions } from "@mui/material";
import { redeemOfferAndUpdateUserStats } from "../shopifyRedeemApi.js";

const ShopifyRedeemSuccess = ({offerData, offerProducts, currentJwt}) => {
  const [ selectedVariantArray, setSelectedVariantArray ] = useState([]);
  const [ redeemButtonIsDisabled, setRedeemButtonIsDisabled ] = useState(true);

  useEffect(() => {
    console.log('offerData', offerData)
    const initialVariants = offerProducts.map(p => {
      return {};
    });
    setSelectedVariantArray(initialVariants);
  }, []);

  const updateSelectedVariant = (variant, index) => {
    const selectedVariantArrayHolder = selectedVariantArray;
    selectedVariantArrayHolder[index] = variant;
    setSelectedVariantArray(selectedVariantArrayHolder);
    let disabled = false;
    selectedVariantArray.forEach(v => {
      if (!v.id) {
        disabled = true;
      }
    })
    setRedeemButtonIsDisabled(disabled);
  }

  const redeemOffer = async () => {
    const redeemOfferObj = {}
    const redeemOfferRes = await redeemOfferAndUpdateUserStats(redeemOfferObj);
  }

  return (
    <Card className={'redeem-success-container'}>
      <span className={'offer-info'}>
        <h1 className={'offer-info-title'}>{offerData.title}</h1>
        {!!offerData.description.length && (
          <h3>{offerData.description}</h3>
        )}
        <p>{offerData.humanizedAccessControlConditions}</p>
        <p>Type of offer: {offerData.offerType}</p>
        <p>Included items: {offerData.assetNameOnService}</p>
      </span>
      <span className={'product-redeem-cards'}>
        {offerProducts.map((product, i) => {
            return (
              <ShopifyProductSelect key={i}
                                    product={product}
                                    index={i}
                                    selectedVariantArray={selectedVariantArray}
                                    updateSelectedVariant={updateSelectedVariant}></ShopifyProductSelect>
            )
          }
        )}
      </span>
      <CardActions>
        <Button disabled={redeemButtonIsDisabled}
                variant={'outlined'}
                onClick={redeemOffer}>Redeem Offer</Button>
      </CardActions>
    </Card>
  )
}

export default ShopifyRedeemSuccess;