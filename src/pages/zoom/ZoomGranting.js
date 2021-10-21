// import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import Meetings from "./ZoomGrantingComponents/Meetings";
import { useAppContext } from "../../context";
import { Button } from "@mui/material";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export default function ZoomGranting() {
  const { performWithAuthSig } = useAppContext();

  const connect = async (service) => {
    await performWithAuthSig(async (authSig) => {
      if (service === "zoom") {
        const resp = await axios.post(`${API_HOST}/api/oauth/zoom/login`, {
          authSig,
        });
        if (resp.data.redirectTo) {
          window.location = resp.data.redirectTo;
        }
      }
    });
  };

  return (
    <section>
      <Button onClick={() => connect("zoom")}>Connect your Zoom account</Button>
      <h3>Zoom Meetings and Webinars</h3>
      <Meetings />
    </section>
    // <Theme preset={presetGpnDefault}>
    //   <div className="App">
    //     <Button
    //       label="Connect your Zoom account"
    //       onClick={() => connect("zoom")}
    //     />
    //   </div>
    // </Theme>
  );
}
