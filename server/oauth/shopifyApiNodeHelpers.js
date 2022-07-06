import Shopify from "shopify-api-node";

export const makeShopifyInstance = (shopName, accessToken) => {
  return new Shopify({
    shopName, accessToken
  });
}

export const updateProductWithTagAndUuid = async (shopifyInstance, draftOrderObj, shopObj, queryObj) => {
  let ids = JSON.parse(draftOrderObj.asset_id_on_service).map(id => {
    return id.split("/").pop();
  })

  let splitTags;
  let resolvedProducts;

  // map over product ids
  try {
    const products = await ids.map(async id => {
      return await shopifyInstance.product.get(id);
    })
    resolvedProducts = await Promise.all(products);
    console.log('resolvedProducts', resolvedProducts);
    splitTags = resolvedProducts.map(p => {
      return p.tags.split(',');
    });
    console.log('splitTags', splitTags);
  } catch (err) {
    console.error("--> Error getting product on save DO:", err);
  }

  // add exclusive or discount tag to list of current tags
  const updatedSplitTags = splitTags.map(s => {
    let updatedTag = s;
    console.log('check split tags', updatedTag)
    if (draftOrderObj.asset_type === 'exclusive' && updatedTag.indexOf('lit-exclusive') === -1) {
      updatedTag.push('lit-exclusive');
    } else if (draftOrderObj.asset_type === 'discount' && updatedTag.indexOf('lit-discount') === -1) {
      updatedTag.push('lit-discount');
    }
    return updatedTag;
  });

  // map over new tag array and update products
  try {
    const updatedProductPromises = resolvedProducts.map(async (p, i) => {
      return await shopifyInstance.product.update(p.id, { tags: updatedSplitTags[i].join(',') });
    })
    const updatedProductsResolved = await Promise.all(updatedProductPromises);
    console.log('UPDATED PRODUCT RESOLVED', updatedProductsResolved)
  } catch (err) {
    console.error("--> Error updating product on save DO:", err);
  };
  // end add exclusive or discount tag to product

  // map over products and add metafield with query id
  try {
    const updatedMetafieldPromises = resolvedProducts.map(async (p, i) => {
      const metafieldObj = {
        owner_id: p.id,
        type: 'single_line_text_field',
        owner_resource: 'product',
        value: queryObj.id,
        namespace: 'lit-offer',
        key: 'lit-offer'
      }
      return await shopifyInstance.metafield.create(metafieldObj);
    })
    const updatedMetafieldResolved = await Promise.all(updatedMetafieldPromises);
    console.log('check on metafield resolved', updatedMetafieldResolved);
  } catch (err) {
    console.log('Error updating product metafields:', err)
  }

  return true;
}

export const removeTagAndMetafieldFromProducts = async (shopifyInstance, draftOrderObj, shopObj, uuid) => {
  let ids = JSON.parse(draftOrderObj.asset_id_on_service).map(id => {
    return id.split("/").pop();
  })

  let splitTags;
  let resolvedProducts;

  // map over product ids
  try {
    const products = await ids.map(async id => {
      return await shopifyInstance.product.get(id);
    })
    resolvedProducts = await Promise.all(products);
    splitTags = resolvedProducts.map(p => {
      return p.tags.split(',');
    });
    console.log('splitTags', splitTags);
  } catch (err) {
    console.error("--> Error getting product on save DO:", err);
  }

  console.log('^^^^^$$$$$ - remove tags products', resolvedProducts);

  try {
    const productMetafieldPromises = resolvedProducts.map(async (p) => {
      return await shopifyInstance.metafield.get(p.id);
    });
    const productMetafieldResolved = Promise.all(productMetafieldPromises);
    console.log('PRODUCT METAFIELD RESOLVED', productMetafieldResolved)
  } catch (err) {
    console.log('Error getting product Metafields:', err);
  }

  return true;

}