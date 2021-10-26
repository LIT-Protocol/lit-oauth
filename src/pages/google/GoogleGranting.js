import { useEffect, useState } from "react";
import { ShareModal } from "lit-access-control-conditions-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader.js";
import ServiceLinks from "../sharedComponents/serviceLinks/ServiceLinks";
import ProvisionAccessModal from "../sharedComponents/provisionAccessModal/ProvisionAccessModal";
import {
  Button, Snackbar,
} from "@mui/material";

import * as asyncHelpers from './googleAsyncHelpers.js';

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
const GOOGLE_CLIENT_KEY =
  process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;

const googleRoleMap = {
  Read: 'reader',
  Comment: 'commenter',
  Write: 'writer',
}

export default function GoogleGranting() {
  const parsedEnv = dotenv.config();

  const [link, setLink] = useState("");
  const [allShares, setAllShares] = useState([]);
  const [token, setToken] = useState("");
  const [connectedServiceId, setConnectedServiceId] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [role, setRole] = useState('reader');
  const [currentUser, setCurrentUser] = useState({});

  const [openShareModal, setOpenShareModal] = useState(false);
  const [openProvisionAccessDialog, setOpenProvisionAccessDialog] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleOpenProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(true);
  };

  const handleAddAccessControl = () => {
    setOpenShareModal(true);
    setOpenProvisionAccessDialog(false);
  }

  const handleGetShareLink = async () => {
    setOpenProvisionAccessDialog(false);
    await handleSubmit();
  }

  const handleCancelProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(false);
    setAccessControlConditions([]);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSnackbar(false);
  }

  useEffect(() => {
    loadGoogleAuth();
  }, []);

  const loadGoogleAuth = async () => {
    window.gapi.load("client:auth2", function () {
      window.gapi.auth2
        .init({
          client_id: GOOGLE_CLIENT_KEY,
          scope:
            "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
        })
        .then((googleObject) => {
          if (googleObject.isSignedIn.get()) {
            const currentUserObject = window.gapi.auth2
              .getAuthInstance()
              .currentUser.get();
            getLatestRefreshToken(currentUserObject);
          }
        });
    });
  }

  const getAuthSig = async () => {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  }

  const getLatestRefreshToken = async (currentUserObject) => {
    const id_token = currentUserObject.getAuthResponse().id_token;
    try {
      const authSig = await getAuthSig();
      const response = await asyncHelpers.verifyToken(authSig, id_token)
      await getGetCurrentUserProfile(response.data, authSig);
    } catch(err) {
      console.log("Error verifying token:", err);
    }
  }

  const getGetCurrentUserProfile = async (uniqueId, authSig) => {
    try {
      const response = await asyncHelpers.getUserProfile(authSig, uniqueId)

      if (response.data[0]) {
        const userProfile = response.data[0];
        setToken(userProfile.refreshToken);
        setCurrentUser({
          email: userProfile.email,
        });
        setConnectedServiceId(userProfile.id);
        await getAllShares();
      }
    } catch(err) {
      console.log("Error loading user profile:", err);
    }
  }

  const getAllShares = async () => {
    const allShares = await asyncHelpers.getAllShares();
    setAllShares(allShares.data);
  }

  const authenticate = async () => {
    const authSig = await getAuthSig();
    try {
      const authResult = await window.gapi.auth2.getAuthInstance().grantOfflineAccess();
      if (authResult.code) {
        console.log("AUTH RESULT", authResult.code);
        setToken(authResult.code);
        await storeToken(authSig, authResult.code);
      }
    } catch(err) {
      console.log('Error loggin in:', err)
    }
  }

  const storeToken = async (authSig, token) => {
    try {
      const response = await asyncHelpers.storeConnectedServiceAccessToken(authSig, token);
      if (!!response.data["connectedServices"]) {
        setConnectedServiceId(response.data.connectedServices[0].id);
      }
    } catch(err) {
      console.log('Error storing access token:', err);
    }
  }

  const signOut = () => {
    const auth2 = window.gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      auth2.disconnect();
    });
    setAccessControlConditions([]);
    setToken("");
  };

  const addToAccessControlConditions = async (r) => {
    const concatAccessControlConditions = accessControlConditions.concat(r);
    await setAccessControlConditions(concatAccessControlConditions);
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
    const requestData = {
      driveId: id,
      role: role,
      token: token,
      connectedServiceId: connectedServiceId,
      accessControlConditions: accessControlConditions,
      authSig,
    };

    console.log('REQUEST DATA', requestData)

    try {
      const response = await asyncHelpers.share(requestData, requestOptions);
      const { data } = response;
      const accessControlConditions = data["authorizedControlConditions"];
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

      console.log("ABOUT TO SAVE", {
        accessControlConditions,
        chain,
        authSig,
        resourceId,
      });
      window.litNodeClient.saveSigningCondition({
        accessControlConditions,
        chain,
        authSig,
        resourceId,
      });
      const humanized = await LitJsSdk.humanizeAccessControlConditions({
        accessControlConditions,
        myWalletAddress: authSig.address,
      });
      console.log("ACCESS CONTROL", humanized)
      console.log("ACCESS CONTROL RAW", accessControlConditions)
      setAccessControlConditions([]);
      await getAllShares();
    } catch(err) {
      console.log('Error sharing link:', err)
    }
  };

  const handleDeleteShare = async (shareInfo) => {
    try {
      await asyncHelpers.deleteShare(shareInfo.id);
      await getAllShares();
      setSnackbarMessage(`${shareInfo.name} has been deleted.`)
      setOpenSnackbar(true);
    } catch(err) {
      console.log('Error deleting share', err);
    }
  }

  const getLinkFromShare = async (linkUuid) => {
    setSnackbarMessage(`Link has been copied to clipboard.`)
    setOpenSnackbar(true);
    await navigator.clipboard.writeText(FRONT_END_HOST + "/l/" + linkUuid)
  }

  if (token === "") {
    return (
      <section>
        <Button onClick={() => authenticate("google")}>
          Connect your Google account
        </Button>
      </section>
    );
  }

  return (
    <section className={"vertical-flex"}>
      {/*TODO: remove 'vertical-flex' from class*/}
      <ServiceHeader
        serviceName={"Google Drive App"}
        oauthServiceProvider={"Google"}
        currentUser={"Comrade Marx"}
        currentUserEmail={currentUser.email}
        signOut={signOut}
      />
      {/*TODO: remove span spacer and orient with html grid*/}
      <span style={{ height: "8rem" }}></span>
      <ServiceLinks
        className={"top-large-margin-buffer"}
        serviceName={"Drive"}
        handleOpenProvisionAccessDialog={handleOpenProvisionAccessDialog}
        handleEditLinkAction={() => console.log('EDIT CLICKED')}
        handleCopyLinkAction={(linkUuid) => getLinkFromShare(linkUuid)}
        handleDownloadLinkAction={() => console.log('DOWNLOAD CLICKED')}
        handleDeleteLinkAction={(linkUuid) => handleDeleteShare(linkUuid)}
        listOfShares={allShares}
      />
      <ProvisionAccessModal
        handleCancelProvisionAccessDialog={handleCancelProvisionAccessDialog}
        accessControlConditions={accessControlConditions}
        removeIthAccessControlCondition={removeIthAccessControlCondition}
        handleAddAccessControl={handleAddAccessControl}
        handleGetShareLink={handleGetShareLink}
        link={link}
        setLink={setLink}
        openProvisionAccessDialog={openProvisionAccessDialog}
        setRole={setRole}
        role={role}
        roleMap={googleRoleMap}
      />
      {openShareModal && (
        <ShareModal
          className={"share-modal"}
          show={false}
          onClose={() => setOpenShareModal(false)}
          sharingItems={[{ name: link }]}
          onAccessControlConditionsSelected={async (restriction) => {
            await addToAccessControlConditions(restriction);
            setOpenShareModal(false);
            setOpenProvisionAccessDialog(true);
          }}
        />
      )}

      <Snackbar
        open={openSnackbar}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
    </section>
  );
}
