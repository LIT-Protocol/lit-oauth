import { Button } from "@consta/uikit/Button";
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import { useAppContext } from "../../context";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export default function GoogleGranting() {
  const { performWithAuthSig } = useAppContext();

  const connect = async (service) => {
    await performWithAuthSig(async (authSig) => {
      if (service === "google") {
        const resp = await axios.post(`${API_HOST}/api/oauth/google/login`, {
          authSig,
        });
        if (resp.data.redirectTo) {
          window.location = resp.data.redirectTo;
        }
      }
    });
  };

  return (
    <Theme preset={presetGpnDefault}>
      <div className="App">
        <Button
          label="Connect your Google account"
          onClick={() => connect("google")}
        />
      </div>
    </Theme>
  );
}
