import React, { Fragment, useEffect, useState } from "react";
import './ShopifyPrepopulateProductSelect.css';
import { Card, FormControl, InputLabel, MenuItem, Select } from "@mui/material";

const ShopifyPrepopulateProductSelect = ({
                                           product,
                                           index,
                                           updateSelectedVariant,
                                           disableSelect,
                                           selectedVariantsArray,
                                           preselectedVariant,
                                           prepopulateStatus
                                         }) => {
  const [ variantMenuOptions, setVariantMenuOptions ] = useState(null);
  const [ selectedVariantMenuOption, setSelectedVariantMenuOption ] = useState('');
  const [ loaded, setLoaded ] = useState(false);

  useEffect(() => {
    let mappedVariantRows = [];
    console.log('&&&&& -> check prepopulateStatus', prepopulateStatus)
    prepopulateStatus.individualStatus.forEach((p) => {
      mappedVariantRows.push(p.title);
      console.log('P', p)
      console.log('p.variant', p.variantId.split('/').pop())
      console.log('preselectedVariant?.productIdParam', preselectedVariant?.productIdParam)
      if (!!preselectedVariant?.productIdParam && p.productId.split('/').pop() === preselectedVariant.productIdParam) {
        setSelectedVariantMenuOption(p.title);
        updateSelectedVariant(p, index);
      }
    });
    setVariantMenuOptions(mappedVariantRows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    console.log('product', product, selectedVariantMenuOption)
    if (selectedVariantMenuOption.length) {
      const selectedVariant = product.variants.find(v => v.title === selectedVariantMenuOption)
      updateSelectedVariant(selectedVariant, index);
    }
  }, [ selectedVariantMenuOption ]);

  return (
    <Card className={'product-card-container'}>
      {loaded && (
        <Fragment>
          <span className={'product-card-top-row'}>
            <div className={'product-card-top-row-left'}>
              {(!!product['images'] && !!product['images'].length && !!product.images['0']['src']) ? (
                <img className={"product-image"} src={product.images[0].src}/>
              ) : (
                <div className={"product-image"}>No image available</div>
              )}
            </div>
            <div className={'product-card-top-row-right'}>
              <p className={'product-card-title'}>{product.title}</p>
              <p className={'product-card-info'}>{product.description}</p>
            </div>
          </span>
          <span className={'product-card-select-row'}>
            {!!variantMenuOptions && (
              <FormControl fullWidth>
                <InputLabel>Select a product</InputLabel>
                <Select value={selectedVariantMenuOption}
                        disabled={disableSelect}
                        className={'product-variant-select'}
                        label={'Select a product'}
                        onChange={(e) => {
                          setSelectedVariantMenuOption(e.target.value);
                        }}
                >
                  {variantMenuOptions.map((v, i) => (
                    <MenuItem key={i} value={v}>{product.title} - {v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </span>
        </Fragment>
      )}
    </Card>

  )
}

export default ShopifyPrepopulateProductSelect;