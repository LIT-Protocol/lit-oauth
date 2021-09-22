import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import LitJsSdk from "lit-js-sdk";
import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";

import { AppContextProvider } from "./context/app";

Bugsnag.start({
  apiKey: "cf16e209b17501304af19b24e1a89eb6",
  plugins: [new BugsnagPluginReact()],
  releaseStage: process.env.LIT_PROTOCOL_OAUTH_ENVIRONMENT,
});

const ErrorBoundary = Bugsnag.getPlugin("react").createErrorBoundary(React);

window.litNodeClient = new LitJsSdk.LitNodeClient({
  alertWhenUnauthorized: false,
});
window.litNodeClient.connect();
window.LitJsSdk = LitJsSdk;

ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
