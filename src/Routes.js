import { Route, Switch } from "react-router-dom";

import { URL_MAP } from "./config";
import ZoomAccess from "./pages/zoom/ZoomAccess";
import ZoomGranting from "./pages/zoom/ZoomGranting";
import GoogleGranting from "./pages/google/GoogleGranting";
import GoogleLinkShare from "./pages/google/GoogleLinkShare";
import ServiceLogin from "./pages/serviceLogin/ServiceLogin";
import ShopifySplash from "./pages/shopify/ShopifySplash";
import ShopifyRedeemOld from "./pages/shopify/ShopifyRedeemOld.js";
import ShopifyDocs from "./pages/shopify/ShopifyDocs";
import ShopifyRedeem from "./pages/shopify/shopifyRedeemComponents/ShopifyRedeem.js";

const ROUTING_COMPONENTS = {
  GoogleGranting: GoogleGranting,
  GoogleLink: GoogleLinkShare,
  ZoomGranting: ZoomGranting,
  ZoomAccess: ZoomAccess,
  ServiceLogin: ServiceLogin,
  ShopifySplash: ShopifySplash,
  ShopifyRedeem: ShopifyRedeem,
  ShopifyDocs: ShopifyDocs
};

const Routes = () => {
  return (
    <>
      <Switch>
        <>
          {Object.keys(URL_MAP).map((k) => (
            <Route
              key={k}
              path={URL_MAP[k].path}
              component={ROUTING_COMPONENTS[URL_MAP[k].componentName]}
              exact={URL_MAP[k].exact}
            />
          ))}
        </>
      </Switch>
    </>
  );
};

export default Routes;
