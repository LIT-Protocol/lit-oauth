import "./App.css";
import { BrowserRouter } from "react-router-dom";
import { Informer } from "@consta/uikit/Informer";
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import Routes from "./Routes";
import { useAppContext } from "./context/app";
import GoogleGranting from "./pages/google/GoogleGranting";
import GoogleLink from "./pages/google/GoogleLink";
import GoogleContainer from "./pages/google/GoogleContainer";

function App() {
  const { globalError } = useAppContext();

  return (
    <div className='split'>
      <span>
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
