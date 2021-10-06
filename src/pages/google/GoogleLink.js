import { useState, useEffect } from "react";
import LitJsSdk from "lit-js-sdk";
import { Button } from "@consta/uikit/Button";
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";

const GOOGLE_CLIENT_KEY = process.env.REACT_APP_CLIENT_KEY;
const BASE_URL = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_URI = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;

function GoogleLink() {
  const gapi = window.gapi;

  const [conditionsFetched, setConditionsFetched] = useState(false);
  const [error, setError] = useState("");
  const [litNodeClient, setLitNodeClient] = useState({});
  const [linkData, setLinkData] = useState([]);
  const [email, setEmail] = useState("");
  const [uuid, setUuid] = useState("");

  gapi.load("client:auth2", function () {
    gapi.auth2.init({
      client_id: GOOGLE_CLIENT_KEY,
      scope:
        "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
    });
  });

  useEffect(() => {
    if (conditionsFetched === false) {
      const uuid = /[^/]*$/.exec(window.location.pathname)[0];
      setUuid(uuid);
      const body = JSON.stringify({ uuid: uuid });
      const headers = { "Content-Type": "application/json" };
      axios.post(`${BASE_URL}/api/google/conditions`, body, { headers })
        .then(async (data) => {
          console.log("OUT THROUGH CONDITIONS")
          setConditionsFetched(true);

          let litNodeClient = new LitJsSdk.LitNodeClient();
          await litNodeClient.connect();
          setLitNodeClient(litNodeClient);
          console.log(data["requirements"]);
          console.log(typeof data["role"]);
          setLinkData(data);
          console.log(data);
        })
        .catch((err) => {
          setError("Invalid link");
        });
    }
  }, []);

  async function provisionAccess() {
    console.log('LINK DATA', linkData)
    const chain = linkData.data.requirements[0].chain;
    const resourceId = {
      baseUrl: FRONT_END_URI,
      path: "/l/" + uuid,
      orgId: "",
      role: linkData.data["role"].toString(),
      extraData: "",
    };

    const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain });

    const jwt = await litNodeClient.getSignedToken({
      accessControlConditions: linkData.data["requirements"],
      chain,
      authSig: authSig,
      resourceId: resourceId,
    });

    return jwt;
  }

  const handleDelete = () => {
    return gapi.auth2
      .getAuthInstance()
      .grantOfflineAccess()
      .then(async (authResult) => {
        if (authResult.code) {
          const body = JSON.stringify({
                uuid: uuid,
                token: authResult.code,
              })
          const headers = { "Content-Type": "application/json" };
          axios.post(`${BASE_URL}/api/google/delete`, body, { headers })
            .then((res) => {
              if (res.status === 500) {
                setError(
                  "Error deleting link; were you the creator of this link?"
                );
              } else {
                setError("Successfully deleted this link.");
              }
            })
            .catch(() =>
              setError(
                "Error deleting link; were you the creator of this link?"
              )
            );
        } else {
          setError("Error logging in");
        }
      });
  };

  const handleSubmit = () => {
    provisionAccess().then((jwt) => {
      const role = linkData["role"];
      const body = JSON.stringify({ email, role, uuid, jwt });
      const headers = { "Content-Type": "application/json" };
      axios.post(`${BASE_URL}/api/google/shareLink`, body, { headers })
        .then((data) =>
            (window.location = `https://docs.google.com/document/d/${data}`)
        );
    });
  };

  if (error !== "") {
    return <div>{error}</div>;
  }

  if (conditionsFetched === false) {
    return <div>Getting data...</div>;
  } else {
    return (
      <Theme preset={presetGpnDefault}>
        <div class="vertical-flex top-margin-buffer">
          <label for="email-input">Enter your Google Account email here</label>
          <input
            type="text"
            name="email-input"
            id="email-input"
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button label="Request Access" className="top-margin-buffer" type="button" onClick={handleSubmit} />
          <Button label="Delete This Link" className="top-margin-buffer" type="button" onClick={handleDelete} />
        </div>
      </Theme>
    );
  }
}

export default GoogleLink;
