import "./App.css";
import { BrowserRouter } from "react-router-dom";
import Routes from "./Routes";
import { useAppContext } from "./context/app";
import { createTheme, ThemeProvider } from "@mui/material";
import { litThemeObject } from "./litTheme";

const litTheme = createTheme(litThemeObject);

function App() {
  const { globalError } = useAppContext();

  return (
    <ThemeProvider theme={litTheme}>
      <BrowserRouter>
        <div className="App">
          {globalError ? (
            <div className="GlobalError">
              <div style={{ height: 24 }} />
              {/*<Informer*/}
              {/*  status="alert"*/}
              {/*  view="filled"*/}
              {/*  title={globalError.title}*/}
              {/*  label={globalError.details}*/}
              {/*/>*/}
              <div style={{ height: 24 }} />
            </div>
          ) : null}
          <Routes />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
