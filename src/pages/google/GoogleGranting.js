import { Button } from "@consta/uikit/Button";
import { useEffect, useState } from "react";
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import { ShareModal } from "lit-access-control-conditions-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import axios from "axios";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
const GOOGLE_CLIENT_KEY = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;

export default function GoogleGranting() {
  const parsedEnv = dotenv.config();

  const [link, setLink] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [role, setRole] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [token, setToken] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);

  useEffect(() => {
    loadGoogleAuth();
  }, []);

  function authenticate() {
    return window.gapi.auth2
      .getAuthInstance()
      .grantOfflineAccess()
      .then(async (authResult) => {
        console.log("authResult: ", authResult);
        if (authResult.code) {
          console.log("AUTH RESULT", authResult.code)
          setToken(authResult.code);
        } else {
          console.log("Error logging in");
        }
      });
  }

  const signOut = () => {
    const auth2 = window.gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      auth2.disconnect();
    });
    setAccessControlConditions([]);
    setToken("");
  };

  const loadGoogleAuth = () => {
    window.gapi.load("client:auth2", function () {
      window.gapi.auth2.init({
        client_id: GOOGLE_CLIENT_KEY,
        scope:
          "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
      });
    });
  };

  const addToAccessControlConditions = (r) => {
    setAccessControlConditions(accessControlConditions.concat(r));
  };

  const removeIthAccessControlCondition = (i) => {
    console.log("accessControl", accessControlConditions);
    let slice1 = accessControlConditions.slice(0, i);
    let slice2 = accessControlConditions.slice(
      i + 1,
      accessControlConditions.length
    );
    setAccessControlConditions(slice1.concat(slice2));
  };

  const handleSubmit = () => {
    console.log('DOUBLE CHECK TOKEN', token)
    const regex = /d\/(.{44})/g;
    let id = link.match(regex)[0];
    id = id.slice(2, id.length);
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    axios
      .post(
        API_HOST + "/api/google/share",
        {
          driveId: id,
          role: role,
          token: token,
          accessControlConditions: accessControlConditions,
        },
        requestOptions
      )
      .then(async (resp) => {
        const { data } = resp;
        console.log("AFTER THE CALL", data);
        const accessControlConditions = data["authorizedControlConditions"];
        console.log("access control conditions is ", accessControlConditions);
        const uuid = data["uuid"];
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
        await window.litNodeClient.saveSigningCondition({
          accessControlConditions,
          chain,
          authSig,
          resourceId,
        });
        setShareLink(FRONT_END_HOST + "/l/" + uuid);
        window.location.href = `${FRONT_END_HOST}/l/${uuid}`;
      });
  };

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
              <Button
                key={i}
                label={JSON.stringify(r)}
                onClick={() => removeIthAccessControlCondition(i)}
              />
            ))}
            <Button
              className="top-margin-buffer"
              label="Add access control conditions"
              type="button"
              onClick={() => setModalOpen(true)}
            />
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
            <Button
              className="top-margin-buffer left-margin-buffer"
              label="Get share link"
              type="button"
              onClick={handleSubmit}
            />
          </form>
        </header>
        <Button
          className="top-margin-buffer"
          label="Sign Out Of Google"
          onClick={signOut}
        />
      </div>
    </Theme>
  );
}
