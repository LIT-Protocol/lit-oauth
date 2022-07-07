import Shopify from "shopify-api-node";

export const makeShopifyInstance = (shopName, accessToken) => {
  return new Shopify({
    shopName, accessToken
  });
}

export const updateProductWithTagAndUuid = async (shopifyInstance, draftOrderObj, shopObj, queryObj) => {
  console.log('!@!@!@!@! ACC:', draftOrderObj)
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
  } catch (err) {
    console.error("--> Error getting product on save DO:", err);
  }

  // add exclusive or discount tag to list of current tags
  const updatedSplitTags = splitTags.map(s => {
    let updatedTag = s;
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
  } catch (err) {
    console.error("--> Error updating product on save DO:", err);
  };
  // end add exclusive or discount tag to product

  // map over products and add metafield with query id
  try {
    const metafieldValue = {
      description: draftOrderObj.humanized_access_control_conditions,
      summary: draftOrderObj.summary,
      title: draftOrderObj.title,
      accessControlConditions: draftOrderObj.access_control_conditions,
      assetType: draftOrderObj.asset_type
    }
    console.log('check metafield valie', metafieldValue)
    const updatedMetafieldPromises = resolvedProducts.map(async (p, i) => {
      const metafieldObj = {
        owner_id: p.id,
        type: 'single_line_text_field',
        owner_resource: 'product',
        value: JSON.stringify(metafieldValue),
        namespace: 'lit_offer',
        key: queryObj.id
      }
      return await shopifyInstance.metafield.create(metafieldObj);
    });
    const updatedMetafieldResolved = await Promise.all(updatedMetafieldPromises);
    console.log('Check new metafields', updatedMetafieldResolved)
  } catch (err) {
    console.log('Error updating product metafields:', err)
  }

  return true;
}

const removeMetafieldFromProducts = async (shopifyInstance, productMetafields, uuid) => {
  const metafieldsToBeRemoved = productMetafields.filter(m => {
    return m.key === uuid;
  })

  const metafieldRemovalPromises = metafieldsToBeRemoved.map(async (m) => {
    return await shopifyInstance.metafield.delete(m.id);
  })

  // switch out function below with function above to delete all metafields for a given product

  // const metafieldRemovalPromises = productMetafields.map(async (m) => {
  //   return await shopifyInstance.metafield.delete(m.id);
  // })

  const metafieldsRemovedResolution = await Promise.all(metafieldRemovalPromises);
  return metafieldsRemovedResolution;
}

export const removeTagAndMetafieldFromProducts = async (shopifyInstance, draftOrderObj, shopObj, uuid) => {
  console.log('check uuid', draftOrderObj)
  let ids = JSON.parse(draftOrderObj.assetIdOnService).map(id => {
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

  try {
    // map over product list and get metafields for each
    const productMetafieldPromises = resolvedProducts.map(async (p) => {
      return await shopifyInstance.metafield.list({
        metafield: {
          owner_resource: 'product', owner_id: p.id
        }
      });
    });
    // resolve promises create an array of arrays [ [], [], [] ]
    const productMetafieldResolved = await Promise.all(productMetafieldPromises);


    // map over resolved metafield arrays and call removeMetafieldFromProducts to delete uuid metafield
    const deletedMetafields = productMetafieldResolved.map(async (m) => {
      return await removeMetafieldFromProducts(shopifyInstance, m, uuid);
    });
    const resolvedDeletedMetafield = await Promise.all(deletedMetafields);
  } catch (err) {
    console.log('Error getting product Metafields:', err);
  }

  return true;

}