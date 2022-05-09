import React, { useEffect, useState } from "react";
import { checkForPromotions } from "./shopifyAsyncHelpers";
import { LinearProgress } from "@mui/material";

import './ShopifyStyles.scss';
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const promotionStatusObj = {
  checking: 'Checking for promotion.',
  notFound: 'Sorry, this promotion does not seem to exist.',
  found: 'Promotion found.'
}

export default function ShopifySplash() {
  const [shopName, setShopName] = useState(null);
  const [promotionStatus, setPromotionStatus] = useState('checking');
  const [connectedToLitNodeClient, setConnectedToLitNodeClient] = useState(false);

  document.addEventListener('lit-ready', function (e) {
    setConnectedToLitNodeClient(true);
  }, false)

  useEffect(() => {
    if (!shopName) {
      const queryString = window.location.search;
      const queryParams = new URLSearchParams(queryString);
      const shop = queryParams.get('shop');
      const productId = queryParams.get('productId');
      // TODO: comment back in
      // window.history.replaceState(null, null, window.location.pathname);
      if (!shop) {
        setPromotionStatus('notFound');
      } else {
        setShopName(shop);
        console.log('Check for shop promotions args:', productId)
        checkForShopPromotions(shop, productId);
      }
    }
  }, [shopName])

  const checkForShopPromotions = async (shop, productId) => {
    try {
      const res = await checkForPromotions(shop, productId);
      console.log('RES', res)
      if (!res.data) {
        setPromotionStatus('notFound');
      } else {
        setPromotionStatus('found');
        console.log('${res.data}', res.data)
        // TODO: comment back in
        const link = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/shopify/l/?id=${res.data}`;
        console.log('link', link)
        // window.location.href = link;
      }
    } catch (err) {
      console.log('Error retrieving access control conditions.');
    }
  }

  return (
    <div className={'full-container'}>
      <section className={'shopify-service-card-container'}>
        <div className={'shopify-service-card'}>
          <div className={'shopify-service-card-header'}>
            <span className={'shopify-service-card-header-left'}>
              <h1>Token Access Verification</h1>
            </span>
            <span className={'shopify-service-card-header-right'}>
                <a href={'https://apps.shopify.com/lit-token-access'} target={'_blank'}
                   rel="noreferrer"><p>Powered by<span
                  className={'lit-gateway-title'}>Lit Token Access</span><OpenInNewIcon
                  className={'open-icon'}/></p></a>
            </span>
          </div>
          <div className={'shopify-service-card-content'}>
            <p>{promotionStatusObj[promotionStatus]}</p>
            {promotionStatus !== 'notFound' && (
              <LinearProgress color={"primary"} className={'.shopify-service-card-loader'}/>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
