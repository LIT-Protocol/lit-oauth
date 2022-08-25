import React, { Fragment, useEffect, useState } from "react";
import './ShopifyProductSelect.css';
import { Card, FormControl, InputLabel, MenuItem, Select } from "@mui/material";

const ShopifyProductSelect = ({
                                product,
                                index,
                                updateSelectedVariant,
                                disableSelect,
                                selectedVariantsArray,
                                preselectedVariant
                              }) => {
  const [ variantMenuOptions, setVariantMenuOptions ] = useState(null);
  const [ selectedVariantMenuOption, setSelectedVariantMenuOption ] = useState('');
  const [ loaded, setLoaded ] = useState(false);

  useEffect(() => {
    const mappedVariantRows = product.variants.map((p) => {
      return p.title
    });
    setVariantMenuOptions(mappedVariantRows);
    if (!!preselectedVariant?.productIdParam && product.id.toString() === preselectedVariant.productIdParam) {
      const presetVariant = product.variants.find(v => v.id.toString() === preselectedVariant.variantIdParam);
      setSelectedVariantMenuOption(presetVariant.title);
      updateSelectedVariant(presetVariant, index);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
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

export default ShopifyProductSelect;