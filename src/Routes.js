import { Route, Switch } from "react-router-dom";

import { URL_MAP } from "./config";

const Routes = () => {
  return (
    <>
      <Switch>
        <>
          {Object.keys(URL_MAP).map((k) => (
            <Route
              key={k}
              path={URL_MAP[k].path}
              component={URL_MAP[k].component}
              exact={URL_MAP[k].exact}
            />
          ))}
        </>
      </Switch>
    </>
  );
};

export default Routes;
