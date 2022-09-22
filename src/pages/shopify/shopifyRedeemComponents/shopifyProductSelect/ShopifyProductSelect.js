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
    let mappedVariantRows = [];
    console.log('check product', product)
    product.variants.forEach((p) => {
      if (!!p.inventory_management && p.inventory_policy === 'deny' && p.inventory_quantity === 0) {
        console.log(`Variant titled '${p.title}' is out of stock. Skipping.`)
      } else {
        mappedVariantRows.push(p.title);
        if (!!preselectedVariant?.productIdParam && p.id.toString() === preselectedVariant.productIdParam) {
          setSelectedVariantMenuOption(p.title);
          updateSelectedVariant(p, index);
        }
      }
    });
    setVariantMenuOptions(mappedVariantRows);
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