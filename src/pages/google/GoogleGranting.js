import { Button } from "@consta/uikit/Button";
import { useState } from 'react'
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import { useAppContext } from "../../context";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export default function GoogleGranting() {

  const { performWithAuthSig } = useAppContext();
  // const [litNodeClient, setLitNodeClient] = useState({});
  // const [link, setLink] = useState("");
  // const [shareLink, setShareLink] = useState("");
  // const [role, setRole] = useState(0);
  // const [modalOpen, setModalOpen] = useState(false);
  // const [token, setToken] = useState("");
  // const [accessControlConditions, setAccessControlConditions] = useState([]);

  const connect = async (service) => {
    await performWithAuthSig(async (authSig) => {
      if (service === "google") {
        const resp = await axios.post(`${API_HOST}/api/oauth/google/login`, {
          authSig,
        });
        console.log('RES0', resp)
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
