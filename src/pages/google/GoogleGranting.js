import { Button } from "@consta/uikit/Button";
import { useState } from 'react'
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import { useAppContext } from "../../context";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const GOOGLE_CLIENT_KEY = process.env.GOOGLE_CLIENT_ID

export default function GoogleGranting() {
  const gapi = window.gapi;

  const { performWithAuthSig } = useAppContext();
  // const [litNodeClient, setLitNodeClient] = useState({});
  // const [link, setLink] = useState("");
  // const [shareLink, setShareLink] = useState("");
  // const [role, setRole] = useState(0);
  // const [modalOpen, setModalOpen] = useState(false);
  // const [token, setToken] = useState("");
  // const [accessControlConditions, setAccessControlConditions] = useState([]);

  // const connect = async (service) => {
  //   await performWithAuthSig(async (authSig) => {
  //     if (service === "google") {
  //       const resp = await axios.post(`${API_HOST}/api/oauth/google/login`, {
  //         authSig,
  //       });
  //       console.log('RES0', resp)
  //       if (resp.data.redirectTo) {
  //         window.location = resp.data.redirectTo;
  //       }
  //     }
  //   });
  // };

  function authenticate() {
    return gapi.auth2
      .getAuthInstance()
      .grantOfflineAccess()
      .then(async (authResult) => {
        console.log('AUTH RESULT', authResult)
        if (authResult.code) {
          var litNodeClient = new LitJsSdk.LitNodeClient();
          await litNodeClient.connect();
          // setLitNodeClient(litNodeClient);
          // setToken(authResult.code);
        } else {
          console.log("Error logging in");
        }
      });
  }

  gapi.load("client:auth2", function () {
    console.log("LOAD")
    gapi.auth2.init({
      client_id: GOOGLE_CLIENT_KEY,
      scope:
        "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
    });
  });

  return (
    <Theme preset={presetGpnDefault}>
      <div className="App">
        <Button
          label="Connect your Google account"
          onClick={() => authenticate("google")}
        />
      </div>
    </Theme>
  );
}
