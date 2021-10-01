import { Button } from "@consta/uikit/Button";
import { useState } from 'react'
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import { ShareModal } from "lit-access-control-conditions-modal";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import { useAppContext } from "../../context";
import dotenv from 'dotenv';

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const GOOGLE_CLIENT_KEY = process.env.REACT_APP_CLIENT_KEY;

export default function GoogleGranting() {

  dotenv.config();
  const gapi = window.gapi;

  const {performWithAuthSig} = useAppContext();
  const [litNodeClient, setLitNodeClient] = useState({});
  const [link, setLink] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [role, setRole] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [token, setToken] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);

  function authenticate() {
    return gapi.auth2
      .getAuthInstance()
      .grantOfflineAccess()
      .then(async (authResult) => {
        console.log('AUTH RESULT', authResult)
        if (authResult.code) {
          var litNodeClient = new LitJsSdk.LitNodeClient();
          await litNodeClient.connect();
          setLitNodeClient(litNodeClient);
          setToken(authResult.code);
        } else {
          console.log("Error logging in");
        }
      });
  }

  const signOut = () => {
    gapi.auth2.signOut();
  }

  const loadGoogleAuth = () => {
    gapi.load("client:auth2", function () {
      console.log("LOAD", process.env.REACT_APP_CLIENT_KEY)
      console.log('DOTENV', process.env)
      gapi.auth2.init({
        client_id: GOOGLE_CLIENT_KEY,
        scope:
          "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
      });
    });
  }

  loadGoogleAuth();

  const addToAccessControlConditions = (r) => {
    setAccessControlConditions(accessControlConditions.concat(r));
  };

  const removeIthAccessControlCondition = (i) => {
    let slice1 = accessControlConditions.slice(0, i);
    let slice2 = accessControlConditions.slice(
      i + 1,
      accessControlConditions.length
    );
    setAccessControlConditions(slice1.concat(slice2));
  };

  const handleSubmit = () => {
    const regex = /d\/(.{44})/g;
    let id = link.match(regex)[0];
    id = id.slice(2, id.length);
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driveId: id,
        role: role,
        token: token,
        accessControlConditions: accessControlConditions,
      }),
    };
    fetch(API_HOST+"/api/share", requestOptions)
      .then((response) => response.json())
      .then(async (data) => {
        console.log(data);
        const accessControlConditions = data["authorizedControlConditions"];
        const uuid = data["uuid"];
        console.log(accessControlConditions);
        const chain = accessControlConditions[0].chain;
        const authSig = await LitJsSdk.checkAndSignAuthMessage({
          chain,
        });
        const resourceId = {
          baseUrl: API_HOST,
          path: "/l/" + uuid,
          orgId: "",
          role: role.toString(),
          extraData: "",
        };
        console.log(accessControlConditions);
        console.log("About to save");
        await litNodeClient.saveSigningCondition({
          accessControlConditions,
          chain,
          authSig,
          resourceId,
        });
        setShareLink(API_HOST+"/l/" + uuid);
      });
  };

  if (shareLink !== "") {
    return <div>Share link: {shareLink}</div>;
  }

  if (token === "") {
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

  return (
    <Theme preset={presetGpnDefault}>
      <div className="App">
        <header className="App-header">
          <p>Enter the link to the drive file below.</p>
          <form>
            <label for="drive-link">Drive Link</label>
            <input
              type="text"
              name="drive-link"
              id="drive-link"
              onChange={(e) => setLink(e.target.value)}
            />

            <p>Added Access Control Conditions (click to delete)</p>
            {accessControlConditions.map((r, i) => (
              <>
                <Button onClick={() => removeIthAccessControlCondition(i)}>
                  {JSON.stringify(r)}
                </Button>
                {/*<button onClick={() => removeIthAccessControlCondition(i)}>*/}
                {/*  {JSON.stringify(r)}*/}
                {/*</button>*/}
              </>
            ))}
            <Button className="top-margin-buffer" label="Add access control conditions" type="button" onClick={() => setModalOpen(true)}/>
            {modalOpen && (
              <ShareModal
                show={false}
                onClose={() => setModalOpen(false)}
                sharingItems={[{ name: link }]}
                onAccessControlConditionsSelected={(restriction) => {
                  addToAccessControlConditions(restriction);
                  setModalOpen(false);
                }}
              />
            )}
            <br />
            <label for="drive-role">Drive Role to share</label>
            <select
              name="drive-role"
              id="drive-role"
              onChange={(e) => setRole(parseInt(e.target.selectedIndex))}
            >
              <option value="read">Read</option>
              <option value="comment">Comment</option>
              <option value="write">Write</option>
            </select>
            <Button className="top-margin-buffer left-margin-buffer" label="Get share link" type="button" onClick={handleSubmit}/>
          </form>
        </header>
        <Button className="top-margin-buffer" label="Sign Out Of Google" onClick={signOut}/>
      </div>
    </Theme>
  );
}
