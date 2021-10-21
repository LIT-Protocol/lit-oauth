import { BrowserRouter } from "react-router-dom";
import Routes from "./Routes";
import { useAppContext } from "./context/app";
import { ThemeProvider, createTheme } from '@mui/material/styles';

import "./App.css";
import GoogleContainer from "./pages/google/GoogleContainer";

const theme = createTheme({
  components: {
    MuiInput: {
      styleOverrides: {
        root: {
          padding: '0.75rem'
        }
      }
    }
  }
})

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
