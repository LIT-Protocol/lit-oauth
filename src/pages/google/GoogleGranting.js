import { useEffect, useState } from "react";
import { ShareModal } from "lit-access-control-conditions-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import axios from "axios";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader.js";
import ServiceLinks from "../sharedComponents/serviceLinks/ServiceLinks";
import ProvisionAccess from "../sharedComponents/provisionAccess/ProvisionAccess";
import { Button } from "@mui/material";
import litJsSdk from "lit-js-sdk";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
const GOOGLE_CLIENT_KEY = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;

const sampleLinks = [
  {
    id: 1,
    fileName: 'Communist Manifesto',
    requirements: 'the hungry masses',
    fileType: 'Doc',
    permission: 'revolution',
    dateCreated: '1848'
  },
  {
    id: 2,
    fileName: 'Das Kapital',
    requirements: 'exploitation of labor',
    fileType: 'Doc',
    permission: 'burn it all down',
    dateCreated: '1867'
  }
]


export default function GoogleGranting() {
  const parsedEnv = dotenv.config();

  const [link, setLink] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [role, setRole] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [token, setToken] = useState("");
  const [connectedServiceId, setConnectedServiceId] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [openProvisionAccessDialog, setOpenProvisionAccessDialog] = useState(false);

  const [currentUser, setCurrentUser] = useState({});



  const handleOpenProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(true);
  };

  const handleCloseProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(false);
  };

  useEffect(() => {
    loadGoogleAuth();
  }, []);

  async function loadGoogleAuth() {
    window.gapi.load("client:auth2", function () {
      window.gapi.auth2.init({
        client_id: GOOGLE_CLIENT_KEY,
        scope:
          "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
      }).then(googleObject => {
        if(googleObject.isSignedIn.get()) {
          const currentUserObject = window.gapi.auth2.getAuthInstance().currentUser.get();
          getLatestRefreshToken(currentUserObject);
        }
      });
    })
  };

  async function getAuthSig() {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  }

  async function getLatestRefreshToken(currentUserObject) {
    const id_token = currentUserObject.getAuthResponse().id_token;
    const authSig = await getAuthSig();
    await axios
      .post(
        API_HOST + "/api/google/verifyToken",
        {
          authSig,
          id_token
        },
      ).then(res => {
        getGetCurrentUserProfile(res.data)
      }).catch(err => console.log('Error loading user:', err))
  }

  // const saveGoogleUserObject = (googleUserObject) => {
  //   console.log('WINDOW', googleUserObject.getAuthResponse())
  //   setToken(googleUserObject.getAuthResponse().id_token);
  //   const currentUserObject = {
  //     name: googleUserObject.getBasicProfile().getName(),
  //     email: googleUserObject.getBasicProfile().getEmail(),
  //   }
  // }

  async function getGetCurrentUserProfile(uniqueId) {
    const authSig = await getAuthSig();
    await axios
      .post(
        API_HOST + "/api/google/getUserProfile",
        {
          authSig,
          uniqueId
        },
      ).then(res => {
        console.log('PROFILE EVERYWHER!', res)
        if (res.data[0]) {
          const userProfile = res.data[0];
          setToken(userProfile.refreshToken);
          setCurrentUser({
            email: userProfile.email,

          })
        }
      })
  }

  async function authenticate() {
    const authSig = await getAuthSig();
    console.log('AUTH SIG', authSig)
    return window.gapi.auth2
      .getAuthInstance()
      .grantOfflineAccess()
      .then(async (authResult) => {
        console.log("authResult: ", authResult);
        if (authResult.code) {
          console.log("AUTH RESULT", authResult.code);
          setToken(authResult.code);
          await storeToken(authSig, authResult.code)
        } else {
          console.log("Error logging in");
        }
      });
  }

  async function storeToken (authSig, token) {
    await axios
      .post(
        API_HOST + "/api/google/connect",
        {
          authSig,
          token
        },
      ).then(res => {
        if (!!res.data['connectedServices']) {
          setConnectedServiceId(res.data.connectedServices[0].id);
        }
      })
  }

  const signOut = () => {
    const auth2 = window.gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      auth2.disconnect();
    });
    setAccessControlConditions([]);
    setToken("");
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

  const handleSubmit = async () => {
    console.log("DOUBLE CHECK TOKEN", token);

    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });

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
          connectedServiceId: connectedServiceId,
          accessControlConditions: accessControlConditions,
          authSig,
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
        console.log('ACCESS CONTROL', window.litNodeClient.humanizeAccessControlConditions(accessControlConditions[0]))
        // litJsSdk.humanizeAccessControlConditions()
        // window.litNodeClient.humanizeAccessControlConditions(accessControlConditions)
        // setShareLink(FRONT_END_HOST + "/l/" + uuid);
        // window.location.href = `${FRONT_END_HOST}/l/${uuid}`;
      });
  };

  if (token === "") {
    return (
      <section>
        <Button onClick={() => authenticate("google")}>Connect your Google account</Button>
      </section>
    );
  }

  return (
    <section className={'vertical-flex'}>
       {/*TODO: remove 'vertical-flex' from class*/}
      <ServiceHeader
        serviceName={'Google Drive App'}
        oauthServiceProvider={'Google'}
        currentUser={'Comrade Marx'}
        currentUserEmail={currentUser.email}
        signOut={signOut}/>
    {/*TODO: remove span spacer and orient with html grid*/}
      <span style={{height: '8rem'}}></span>
      <ServiceLinks
        className={'top-large-margin-buffer'}
        serviceName={'Drive'}
        handleOpenProvisionAccessDialog={handleOpenProvisionAccessDialog}
        listOfLinks={sampleLinks}/>
      <ProvisionAccess
        handleCloseProvisionAccessDialog={handleCloseProvisionAccessDialog}
        link={link}
        openProvisionAccessDialog={openProvisionAccessDialog}
        setModalOpen={setModalOpen}
        setRole={setRole}
        role={role}
        setLink={setLink}/>
      {modalOpen && (
        <ShareModal
          className={'share-modal'}
          show={false}
          onClose={() => setModalOpen(false)}
          sharingItems={[{ name: link }]}
          onAccessControlConditionsSelected={(restriction) => {
            addToAccessControlConditions(restriction);
            setModalOpen(false);
          }}
      />)}


      <div className="App">
        <header className="App-header">
          <p>Enter the link to the drive file below.</p>
          <form>
            <label htmlFor="drive-link">Drive Link</label>
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
              >{JSON.stringify(r)}</Button>
            ))}
            <Button
              className="top-margin-buffer"
              label="Add access control conditions"
              type="button"
              onClick={() => setModalOpen(true)}
            >Add Access Control Conditions</Button>
            {modalOpen && (
              <ShareModal
                show={false}
                onClose={() => setModalOpen(false)}
                sharingItems={[{name: link}]}
                onAccessControlConditionsSelected={(restriction) => {
                  addToAccessControlConditions(restriction);
                  setModalOpen(false);
                }}
              />
            )}
            <br/>
            <label htmlFor="drive-role">Drive Role to share</label>
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
            >Get Share Link</Button>
          </form>
        </header>
      </div>
    </section>



  );
}
