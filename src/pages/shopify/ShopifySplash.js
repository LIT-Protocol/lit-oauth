import React, { useEffect, useState } from "react";
import { checkForPromotions } from "./shopifyAsyncHelpers";
import { CircularProgress, Card, CardContent, CardActions, Tooltip } from "@mui/material";

import './ShopifySplash.scss';
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const promotionStatusObj = {
  checking: 'Checking for promotion.',
  notFound: 'Sorry, no promotion was found.',
  found: 'Promotion found.'
}

export default function ShopifySplash() {
  const [shopName, setShopName] = useState(null);
  const [promotionStatus, setPromotionStatus] = useState('checking');

  useEffect(() => {
    if (!shopName) {
      const queryString = window.location.search;
      const queryParams = new URLSearchParams(queryString);
      const shop = queryParams.get('shop');
      const productId = queryParams.get('productId');
      window.history.replaceState(null, null, window.location.pathname);
      if (!shop) {
        setPromotionStatus('notFound');
      } else {
        setShopName(shop);
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
        // setTimeout(() => {
        window.location.href = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/shopify/l/?id=${res.data}`;
        // }, 500);
      }
    } catch (err) {
      console.log('Error retrieving access control conditions');
    }
  }

  return (
    <div>
      <div className={'access-service-background'}/>
      <section className={'access-service-card-container'}>
        <Card className={'access-service-card'}>
          <CardContent className={'access-service-card-header'}>
            <span className={'access-service-card-header-left'}>
                {/*<span className={'logo-container'}>*/}
              {/*  <img className={"shopify-logo"} src={'/shopifyLogo.svg'}/>*/}
              {/*  <h1 className={"logo-plus"}>+</h1>*/}
              {/*  <img className={"lit-logo"} src={'/appslogo.svg'}/>*/}
              {/*</span>*/}
              <div style={{ backgroundImage: `url('/appslogo.svg')` }} className={'access-service-card-logo'}/>
              <div className={'access-service-card-title'}>
                <h2>Lit Apps</h2>
                <p>The power of blockchain-defined access combine with your current tool suite.</p>
              </div>
            </span>
            <span className={'access-service-card-header-right'}>
                <a href={'https://litgateway.com/'} target={'_blank'}><p>Find more apps on the<strong
                  className={'lit-gateway-title'}>Lit Gateway</strong><OpenInNewIcon/></p></a>
            </span>
          </CardContent>
          <CardContent className={'access-service-card-content'}>
            <div className={"center-content"}>
              {promotionStatus !== 'notFound' && (
                <CircularProgress className={"spinner"}/>
              )}
              <p>{promotionStatusObj[promotionStatus]}</p>
            </div>
            {/*<div className={'shopify-splash-container'}>*/}
            {/*<span className={'logo-container'}>*/}
            {/*    <img className={"shopify-logo"} src={'/shopifyLogo.svg'}/>*/}
            {/*    <h1 className={"logo-plus"}>+</h1>*/}
            {/*    <img className={"lit-logo"} src={'/appslogo.svg'}/>*/}
            {/*  </span>*/}
            {/*</div>*/}
          </CardContent>
          {/*<CardActions className={'access-service-card-actions'} style={{ padding: '0' }}>*/}
          {/*  {storedAuthSig && accessVerified && !loading && (*/}
          {/*    <Tooltip title={getSubmitTooltip()} placement="top">*/}
          {/*        <span className={"access-service-card-launch-button"} onClick={async () => {*/}
          {/*          await redeemPromotion();*/}
          {/*        }}>*/}
          {/*          Redeem Promotion*/}
          {/*          <svg width="110" height="23" viewBox="0 0 217 23" fill="none" xmlns="http://www.w3.org/2000/svg">*/}
          {/*            <path d="M0.576416 20.9961H212.076L184.076 1.99609" stroke="white" strokeWidth="3"/>*/}
          {/*          </svg>*/}
          {/*        </span>*/}
          {/*    </Tooltip>*/}
          {/*    // <div>*/}
          {/*    //   /!*{!!product && product.images[0].src && (*!/*/}
          {/*    //   /!*  <img className={"product-image"} src={product.images[0].src}/>*!/*/}
          {/*    //   /!*)}*!/*/}
          {/*    //   <p>You qualify!</p>*/}
          {/*    //   <Button onClick={() => redeemPromotion()}>Click to redeem</Button>*/}
          {/*    // </div>*/}
          {/*  )}*/}
          {/*</CardActions>*/}
        </Card>
        {/*<Snackbar*/}
        {/*  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}*/}
        {/*  open={openSnackbar}*/}
        {/*  autoHideDuration={4000}*/}
        {/*  onClose={handleCloseSnackbar}*/}
        {/*>*/}
        {/*  <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>*/}
        {/*</Snackbar>*/}
      </section>
    </div>
    // <div className={'shopify-splash-container'}>
    //   <span className={'logo-container'}>
    //     <img className={"shopify-logo"} src={'/shopifyLogo.svg'}/>
    //     <h1 className={"logo-plus"}>+</h1>
    //     <img className={"lit-logo"} src={'/appslogo.svg'}/>
    //   </span>
    //   {promotionStatus !== 'notFound' && (
    //     <CircularProgress className={"spinner"}/>
    //   )}
    //   <p>{promotionStatusObj[promotionStatus]}</p>
    // </div>
  )
}
