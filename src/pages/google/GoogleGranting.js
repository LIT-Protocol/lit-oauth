import { useEffect, useState } from "react";
import { ShareModal } from "lit-access-control-conditions-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader.js";
import ServiceLinks from "../sharedComponents/serviceLinks/ServiceLinks";
import ProvisionAccessModal from "../sharedComponents/provisionAccessModal/ProvisionAccessModal";
import { Alert, Button, Snackbar } from "@mui/material";
// import googleDriveLogo from '../../assets/googledrive.png';

import "./GoogleGranting.scss";
import * as asyncHelpers from "./googleAsyncHelpers.js";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
const GOOGLE_CLIENT_KEY =
  process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;

const googleRoleMap = {
  Read: "reader",
  Comment: "commenter",
  Write: "writer",
};

export default function GoogleGranting() {
  const parsedEnv = dotenv.config();

  const [link, setLink] = useState("");
  const [allShares, setAllShares] = useState([]);
  const [token, setToken] = useState("");
  const [connectedServiceId, setConnectedServiceId] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [role, setRole] = useState("reader");
  const [currentUser, setCurrentUser] = useState({});
  const [storedAuthSig, setStoredAuthSig] = useState({});
  const [humanizedAccessControlArray, setHumanizedAccessControlArray] =
    useState([]);

  const [openShareModal, setOpenShareModal] = useState(false);
  const [openProvisionAccessDialog, setOpenProvisionAccessDialog] =
    useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({});

  const handleAddAccessControl = () => {
    setOpenShareModal(true);
    setOpenProvisionAccessDialog(false);
  };

  const handleGetShareLink = async () => {
    setOpenProvisionAccessDialog(false);
    setLink("");
    await handleSubmit();
  };

  const handleOpenProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(true);
  };

  const handleCancelProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(false);
    setAccessControlConditions([]);
    setLink("");
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpenSnackbar(false);
  };

  useEffect(() => {
    console.log("CHECK UP ON TOKEN", token);
  }, [token]);

  useEffect(() => {
    // getAuthSig();
    // loadGoogleAuth();
    loadAuth();
  }, []);

  useEffect(() => {
    const humanizeAccessControlConditions = async () => {
      return await LitJsSdk.humanizeAccessControlConditions({
        accessControlConditions,
        myWalletAddress: storedAuthSig.address,
      });
    };
    humanizeAccessControlConditions().then(
      (humanizedAccessControlConditions) => {
        setHumanizedAccessControlArray(() => humanizedAccessControlConditions);
      }
    );
  }, [accessControlConditions]);

  const loadAuth = async () => {
    try {
      const litAuthResult = await LitJsSdk.checkAndSignAuthMessage({
        chain: "ethereum",
      });
      setStoredAuthSig(() => litAuthResult);
      await loadGoogleAuth();
    } catch (err) {
      console.log("LIT AUTH FAILURE", err);
    }
  };

  const loadGoogleAuth = async () => {
    window.gapi.load("picker", function () {
      console.log("picker loaded");
    });
    window.gapi.load("client:auth2", function () {
      window.gapi.auth2
        .init({
          client_id: GOOGLE_CLIENT_KEY,
          scope: "https://www.googleapis.com/auth/drive.file",
        })
        .then((googleObject) => {
          if (googleObject.isSignedIn.get()) {
            console.log("IS SIGNED IN");
            const currentUserObject = window.gapi.auth2
              .getAuthInstance()
              .currentUser.get();
            setLatestAccessToken(currentUserObject);
          }
        });
    });
    window.gapi.load("picker", { callback: onPickerApiLoad });
  };

  const onPickerApiLoad = () => {
    console.log("PICKER LOADED");
  };

  const getAuthSig = async () => {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  };

  const setLatestAccessToken = async (currentUserObject) => {
    const googleAuthResponse = currentUserObject.getAuthResponse();
    try {
      const authSig = await getAuthSig();
      setStoredAuthSig(authSig);
      let response;
      try {
        response = await asyncHelpers.verifyToken(authSig, googleAuthResponse);
      } catch (e) {
        console.log(
          "error verifying user token.  this happens if the user hasn't connected a google account yet.  swallowing.",
          e
        );
        return;
      }

      setConnectedServiceId(() => response.data.connectedServices[0].id);
      setCurrentUser(() => response.data.userProfile);
      setToken(() => googleAuthResponse.access_token);
      await getAllShares();
    } catch (err) {
      console.log("Error verifying user:", err);
      setSnackbarInfo({
        message: `Error verifying user:, ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const getAllShares = async () => {
    const allShares = await asyncHelpers.getAllShares();
    setAllShares(allShares.data.reverse());
  };

  const authenticate = async () => {
    const authSig = await getAuthSig();
    setStoredAuthSig(authSig);
    try {
      const authResult = await window.gapi.auth2
        .getAuthInstance()
        .grantOfflineAccess({
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      if (authResult.code) {
        await storeToken(authSig, authResult.code);
      }
    } catch (err) {
      console.log("Error logging in:", err);
      setSnackbarInfo({
        message: `Error logging in: ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const storeToken = async (authSig, token) => {
    try {
      const response = await asyncHelpers.storeConnectedServiceAccessToken(
        authSig,
        token
      );
      if (!!response.data["connectedServices"]) {
        await setConnectedServiceId(response.data.connectedServices[0].id);
        const googleAuthInstance = window.gapi.auth2.getAuthInstance();
        const currentUserObject = googleAuthInstance.currentUser.get();
        setToken(() => currentUserObject.getAuthResponse().access_token);
        const userBasicProfile = currentUserObject.getBasicProfile();
        const userProfile = {
          email: userBasicProfile.getEmail(),
          displayName: userBasicProfile.getName(),
          givenName: userBasicProfile.getGivenName(),
          avatar: userBasicProfile
            .getName()
            .split(" ")
            .map((s) => s.split("")[0])
            .join(""),
        };
        setCurrentUser(() => userProfile);
      }
    } catch (err) {
      console.log(`Error storing access token:, ${err}`);
      setSnackbarInfo({
        message: `Error storing access token:, ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const signOut = () => {
    const auth2 = window.gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      auth2.disconnect();
    });
    setAccessControlConditions([]);
    setToken("");
    setCurrentUser({});
  };

  const addToAccessControlConditions = async (r) => {
    const concatAccessControlConditions = accessControlConditions.concat(r);
    await setAccessControlConditions(concatAccessControlConditions);
  };

  const removeIthAccessControlCondition = async (i) => {
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

    const id = link.match(/[-\w]{25,}(?!.*[-\w]{25,})/)[0];

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

    try {
      const response = await asyncHelpers.share(requestData, requestOptions);
      const { data } = response;
      const accessControlConditions = data["authorizedControlConditions"];
      const uuid = data["uuid"];
      const chain = accessControlConditions[0].chain;
      const authSig = await getAuthSig();
      const resourceId = {
        baseUrl: API_HOST,
        path: "/google/l/" + uuid,
        orgId: "",
        role: role.toString(),
        extraData: "",
      };

      window.litNodeClient.saveSigningCondition({
        accessControlConditions,
        chain,
        authSig,
        resourceId,
      });

      setAccessControlConditions([]);
      setSnackbarInfo({
        message: `New link created.`,
        severity: "success",
      });
      setOpenSnackbar(true);
      await getAllShares();
    } catch (err) {
      console.log(`'Error sharing share', ${err}`);
      setSnackbarInfo({
        message: `'Error sharing share', ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const handleDeleteShare = async (shareInfo) => {
    try {
      await asyncHelpers.deleteShare(shareInfo.id);
      await getAllShares();
      setSnackbarInfo({
        message: `${shareInfo.name} has been deleted.`,
        severity: "success",
      });
      setOpenSnackbar(true);
    } catch (err) {
      console.log(`'Error deleting share', ${err}`);
      setSnackbarInfo({
        message: `'Error deleting share', ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const getLinkFromShare = async (linkUuid) => {
    setSnackbarInfo({
      message: `Link has been copied to clipboard.`,
      severity: "info",
    });
    setOpenSnackbar(true);
    await navigator.clipboard.writeText(
      FRONT_END_HOST + "/google/l/" + linkUuid
    );
  };

  if (!storedAuthSig.sig) {
    return (
      <section>
        <p>Login with your wallet to proceed.</p>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          open={openSnackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
        </Snackbar>
      </section>
    );
  }

  if (token === "") {
    return (
      <section>
        <Button onClick={() => authenticate("google")}>
          Connect your Google account
        </Button>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          open={openSnackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
        </Snackbar>
      </section>
    );
  }

  return (
    <section className={"service-grid-container"}>
      <div className={"service-grid-header"}>
        <ServiceHeader
          serviceName={"Google Drive App"}
          oauthServiceProvider={"Google"}
          currentUser={currentUser}
          signOut={signOut}
        />
      </div>
      <div className={"service-grid-links"}>
        <ServiceLinks
          className={"service-links"}
          serviceName={"Drive"}
          handleOpenProvisionAccessDialog={handleOpenProvisionAccessDialog}
          handleEditLinkAction={() => console.log("EDIT CLICKED")}
          handleCopyLinkAction={(linkUuid) => getLinkFromShare(linkUuid)}
          handleDownloadLinkAction={() => console.log("DOWNLOAD CLICKED")}
          handleDeleteLinkAction={(linkUuid) => handleDeleteShare(linkUuid)}
          listOfShares={allShares}
        />
      </div>
      <ProvisionAccessModal
        handleCancelProvisionAccessDialog={handleCancelProvisionAccessDialog}
        accessControlConditions={accessControlConditions}
        removeIthAccessControlCondition={removeIthAccessControlCondition}
        setAccessControlConditions={setAccessControlConditions}
        humanizedAccessControlArray={humanizedAccessControlArray}
        handleAddAccessControl={handleAddAccessControl}
        handleGetShareLink={handleGetShareLink}
        accessToken={token}
        authSig={storedAuthSig}
        link={link}
        setLink={setLink}
        role={role}
        setRole={setRole}
        roleMap={googleRoleMap}
        openProvisionAccessDialog={openProvisionAccessDialog}
        setOpenProvisionAccessDialog={setOpenProvisionAccessDialog}
      />
      {openShareModal && (
        <ShareModal
          showStep="ableToAccess"
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
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={openSnackbar}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
      </Snackbar>
    </section>
  );
}
