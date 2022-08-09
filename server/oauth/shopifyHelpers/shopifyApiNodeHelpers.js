import Shopify from "shopify-api-node";

export const makeShopifyInstance = (shopName, accessToken) => {
  return new Shopify({
    shopName, accessToken
  });
}

export const updateProductWithTagAndUuid = async (shopifyInstance, queryObj, shopObj) => {
  let ids = JSON.parse(queryObj.asset_id_on_service).map(id => {
    return id.split("/").pop();
  })

  console.log('ids', ids)

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
  // TODO: might not need tags anymore
  const updatedSplitTags = splitTags.map(s => {
    let updatedTag = s;
    if (queryObj.asset_type === 'exclusive' && updatedTag.indexOf('lit-exclusive') === -1) {
      updatedTag.push('lit-exclusive');
    } else if (queryObj.asset_type === 'discount' && updatedTag.indexOf('lit-discount') === -1) {
      updatedTag.push('lit-discount');
    }
    return updatedTag;
  });

  // map over new tag array and update products
  try {
    const updatedProductPromises = resolvedProducts.map(async (p, i) => {
      return await shopifyInstance.product.update(p.id, {tags: updatedSplitTags[i].join(',')});
    })
    const updatedProductsResolved = await Promise.all(updatedProductPromises);
  } catch (err) {
    console.error("--> Error updating product on save DO:", err);
  }
  // end add exclusive or discount tag to product

  // map over products and add metafield with query id
  let metafieldValue = {};
  try {
    metafieldValue = {
      description: queryObj?.description ? queryObj.description : queryObj.humanized_access_control_conditions,
      summary: queryObj.summary,
      title: queryObj.title,
      accessControlConditions: queryObj.access_control_conditions,
      offerType: queryObj.offer_type,
      offerId: queryObj.id,
      extraData: queryObj.extra_data,
      usedChains: queryObj.used_chains,
      conditionTypes: queryObj.condition_types,
      redeemAddress: `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/shopify/redeem/?id=${queryObj.id}`
    }
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
  } catch (err) {
    console.log('Error updating product metafields:', err)
  }

  return metafieldValue;
}

const removeMetafieldFromProducts = async (shopifyInstance, productMetafields = [], uuid) => {
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

export const addShopifyMetafieldToDraftOrder = async ({shopify, draftOrderRes}) => {
  const lineItems = draftOrderRes.line_items.map(d => {
    return d.id;
  })

  const metafieldObj = {
    namespace: 'web_3',
    key: 'gated_wallet_line_items',
    owner_id: draftOrderRes.id,
    value: JSON.stringify(lineItems),
    owner_resource: 'draft_order',
  }
  try {
    const metafieldRes = await shopify.metafield.create(metafieldObj);
  } catch (err) {
    return err;
    console.log('Error creating metafield for draft order:', err);
  }
}

export const createNoteAttributesAndTags = ({draftOrderDetails, authSig, selectedNft}) => {
  let noteAttributes = [];
  let tags = [];

  console.log('selectedNft', selectedNft)

  if (draftOrderDetails['hasRedeemLimit']) {
    if (draftOrderDetails.typeOfRedeem === 'nftId') {
      tags.push(`lit-nftId`);
      // tags.push(selectedNft.nft.contract.address);
      // tags.push(selectedNft.nft.id.tokenId);
      const nftIdNote = {
        name: 'Redeem Limited by NFT ID',
        value: `NFT contract address: ${selectedNft.nft.contract.address} - NFT TokenId: ${selectedNft.nft.id.tokenId}`
      }
      noteAttributes.push(nftIdNote);
    } else {
      tags.push(`lit-walletAddress`);
      const splitConditionTypes = draftOrderDetails.conditionTypes.split(',');
      if (splitConditionTypes.indexOf('evmBasic') !== -1) {
        // tags.push(authSig.ethereum.address);
        const nftIdNote = {
          name: 'Redeem Limited by EVM wallet address',
          value: `EVM wallet address: ${authSig.ethereum.address}`
        }
        noteAttributes.push(nftIdNote);
      }
      if (splitConditionTypes.indexOf('solRpc') !== -1) {
        // tags.push(authSig.solana.address);
        const nftIdNote = {
          name: 'Redeem Limited by Solana wallet address',
          value: `Solana wallet address: ${authSig.solana.address}`
        }
        noteAttributes.push(nftIdNote);
      }
    }
  }

  if (draftOrderDetails['typeOfAccessControl'] === 'exclusive') {
    tags.push('lit-exclusive');
  } else {
    tags.push('lit-discount');
  }

  return {
    tags: tags.join(','),
    note_attributes: noteAttributes
  }
}