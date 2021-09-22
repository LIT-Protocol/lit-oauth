import "./App.css";
import { BrowserRouter } from "react-router-dom";
import { Button } from "@consta/uikit/Button";
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import Routes from "./Routes";

function App() {
  return (
    <BrowserRouter>
      <Theme preset={presetGpnDefault}>
        <div className="App">
          <Routes />
        </div>
      </Theme>
    </BrowserRouter>
  );
}

export default App;
