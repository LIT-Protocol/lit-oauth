import { Route, Switch } from "react-router-dom";

import { URL_MAP } from "./config";
import ZoomAccess from "./pages/zoom/ZoomAccess";
import ZoomGranting from "./pages/zoom/ZoomGranting";
import GoogleGranting from "./pages/google/GoogleGranting";
import GoogleLinkShare from "./pages/google/GoogleLinkShare";
import ServiceLogin from "./pages/serviceLogin/ServiceLogin";

const ROUTING_COMPONENTS = {
  GoogleGranting: GoogleGranting,
  GoogleLink: GoogleLinkShare,
  ZoomGranting: ZoomGranting,
  ZoomAccess: ZoomAccess,
  ServiceLogin: ServiceLogin,
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
