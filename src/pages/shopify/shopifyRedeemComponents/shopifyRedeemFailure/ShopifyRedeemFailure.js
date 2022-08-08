import { Fragment } from "react";
import { Card, CardHeader, CardContent } from "@mui/material";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import './ShopifyRedeemFailure.css';

const ShopifyRedeemFailure = ({redeemFailureMessage}) => {
  console.log('redeemFailureMessage', redeemFailureMessage)
  return (
    <Fragment>
      <Card>
        <span className={'fail-card-header'}>
          <ErrorOutlineIcon className={'fail-card-header-icon'} color={'error'} fontSize={'large'}/>
          <h2 className={'fail-card-header-title'}>{redeemFailureMessage.title}</h2>
        </span>
        <CardContent className={'fail-card-contents'}>
          {!!redeemFailureMessage.detailList?.length && (
            redeemFailureMessage.detailList.map((d, i) => {
              return (
                <p key={i}>{d}</p>
              )
            })
          )}
        </CardContent>

      </Card>
    </Fragment>
  )
}

export default ShopifyRedeemFailure;