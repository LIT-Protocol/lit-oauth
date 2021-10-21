import { BrowserRouter } from "react-router-dom";
import { Informer } from "@consta/uikit/Informer";
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import Routes from "./Routes";
import { useAppContext } from "./context/app";

import "./App.css";
import GoogleContainer from "./pages/google/GoogleContainer";
import ServiceHeader from "./pages/sharedComponents/serviceHeader/ServiceHeader";
import ServiceLinks from "./pages/sharedComponents/serviceLinks/ServiceLinks";

function App() {
  const { globalError } = useAppContext();

  return (
    <div>
      <span className={'vertical-flex'}>
        <GoogleContainer />
      </span>
      {/*<BrowserRouter>*/}
      {/*  <Theme preset={presetGpnDefault}>*/}
      {/*    <div className="App">*/}
      {/*      {globalError ? (*/}
      {/*        <div className="GlobalError">*/}
      {/*          <div style={{ height: 24 }} />*/}
      {/*          <Informer*/}
      {/*            status="alert"*/}
      {/*            view="filled"*/}
      {/*            title={globalError.title}*/}
      {/*            label={globalError.details}*/}
      {/*          />*/}
      {/*          <div style={{ height: 24 }} />*/}
      {/*        </div>*/}
      {/*      ) : null}*/}
      {/*      <Routes />*/}
      {/*    </div>*/}
      {/*  </Theme>*/}
      {/*</BrowserRouter>*/}
    </div>
  );
}

export default App;
