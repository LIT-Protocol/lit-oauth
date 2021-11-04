import { useEffect, useState } from "react";
import { ShareModal } from "lit-access-control-conditions-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader.js";
import GoogleLinks from "./googleLinks/GoogleLinks";
import GoogleProvisionAccessModal from "./googleProvisionAccessModal/GoogleProvisionAccessModal";
import {
  Alert,
  Button,
  Card,
  Snackbar,
  Avatar,
  CardContent,
} from "@mui/material";
// import googleDriveLogo from '../../assets/googledrive.png';
import googleLoginButton from "../../assets/btn_google_signin_dark_normal_web@2x.png";

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

  const [file, setFile] = useState(null);
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

  useEffect(() => {
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

  const handleAddAccessControl = () => {
    setOpenShareModal(true);
    setOpenProvisionAccessDialog(false);
  };

  const handleGetShareLink = async () => {
    setOpenProvisionAccessDialog(false);
    setFile(null);
    await handleSubmit();
  };

  const handleOpenProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(true);
  };

  const handleCancelProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(false);
    setAccessControlConditions([]);
    setFile(null);
  };

  const handleOpenSnackBar = (message, severity) => {
    setSnackbarInfo({
      message: message,
      severity: severity,
    });
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpenSnackbar(false);
  };

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
    window.gapi.load("client:auth2", function () {
      window.gapi.auth2
        .init({
          client_id: GOOGLE_CLIENT_KEY,
          scope: "https://www.googleapis.com/auth/drive.file",
        })
        .then(async (googleObject) => {
          const currentUserObject = window.gapi.auth2
            .getAuthInstance()
            .currentUser.get();
          const grantedScopes = currentUserObject.getGrantedScopes();
          // check to see if signed in and scope for drive exists, if scope does not exist but use is signed in, notify with snackbar and sign out the user
          if (
            googleObject.isSignedIn.get() &&
            !!grantedScopes &&
            grantedScopes.includes("https://www.googleapis.com/auth/drive.file")
          ) {
            await checkForUserLocally(currentUserObject);
          } else if (
            googleObject.isSignedIn.get() &&
            !grantedScopes.includes(
              "https://www.googleapis.com/auth/drive.file"
            )
          ) {
            handleOpenSnackBar(
              `Insufficient Permission: Request had insufficient authentication scopes.`,
              "error"
            );
            signOut();
          }
        });
    });
    window.gapi.load("picker", { callback: onPickerApiLoad });
  };

  const onPickerApiLoad = () => {
    console.log("Google Picker Loaded");
  };

  const getAuthSig = async () => {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  };

  const checkForUserLocally = async (currentUserObject) => {
    const authSig = await getAuthSig();
    setStoredAuthSig(authSig);
    try {
      const userProfiles = await asyncHelpers.getUserProfile(
        authSig,
        currentUserObject.getId()
      );
      if (userProfiles?.data[0]) {
        await setLatestAccessToken(currentUserObject);
      } else {
        console.log("No user found locally. Please log in again.");
        handleOpenSnackBar(
          `No user found locally. Please log in again.`,
          "error"
        );
      }
    } catch (err) {
      console.log("No user found locally:", err);
      handleOpenSnackBar(`No user found locally: ${err}`, "error");
    }
  };

  const setLatestAccessToken = async (currentUserObject) => {
    const googleAuthResponse = currentUserObject.getAuthResponse();
    try {
      const authSig = await getAuthSig();
      const response = await asyncHelpers.verifyToken(
        authSig,
        googleAuthResponse
      );

      setConnectedServiceId(() => response.data.connectedServices[0].id);
      setCurrentUser(() => response.data.userProfile);
      setToken(() => googleAuthResponse.access_token);
      await getAllShares(authSig);
    } catch (err) {
      console.log("Error verifying user:", err);
      handleOpenSnackBar(`Error verifying user:, ${err}`, "error");
    }
  };

  const getAllShares = async (authSig) => {
    const allSharesHolder = await asyncHelpers.getAllShares(authSig);
    setAllShares(allSharesHolder.data.reverse());
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
      handleOpenSnackBar(`Error logging in: ${err}`, "error");
    }
  };

  const storeToken = async (authSig, token) => {
    try {
      const response = await asyncHelpers.storeConnectedServiceAccessToken(
        authSig,
        token
      );
      console.log("ERROR MAYBE?", response);
      if (response.data["errorStatus"]) {
        handleOpenSnackBar(
          `Error logging in: ${response.data.errors[0]["message"]}`,
          "error"
        );
        signOut();
        return;
      }
      if (!!response.data["connectedServices"]) {
        console.log(
          'response.data["connectedServices"]',
          response.data["connectedServices"]
        );
        await setConnectedServiceId(response.data.connectedServices[0].id);
        const googleAuthInstance = window.gapi.auth2.getAuthInstance();
        const currentUserObject = googleAuthInstance.currentUser.get();
        console.log("currentUserObject ", currentUserObject);
        const token = currentUserObject.getAuthResponse(true).access_token;
        console.log("access_token", token);
        setToken(token);
        console.log(
          "currentUserObject after getting auth response with tokens",
          currentUserObject
        );
        const userBasicProfile = currentUserObject.getBasicProfile();
        console.log("userBasicProfile", userBasicProfile);
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
      console.log(`Error storing access token:, ${err.errors}`, err);
      handleOpenSnackBar(`Error storing access token:, ${err}`, "error");
      signOut();
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
    // setAccessControlConditions([]);
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
    // const id = file.embedUrl.match(/[-\w]{25,}(?!.*[-\w]{25,})/)[0]
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    const requestData = {
      driveId: file.id,
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
      handleOpenSnackBar(
        `New link created and copied to clipboard.`,
        "success"
      );
      await navigator.clipboard.writeText(FRONT_END_HOST + "/google/l/" + uuid);
      await getAllShares(authSig);
    } catch (err) {
      console.log(`'Error sharing share', ${err}`);
      handleOpenSnackBar(`'Error sharing share', ${err}`, "error");
    }
  };

  const handleDeleteShare = async (shareInfo) => {
    try {
      await asyncHelpers.deleteShare(shareInfo.id);
      await getAllShares(storedAuthSig);
      handleOpenSnackBar(`${shareInfo.name} has been deleted.`, "success");
    } catch (err) {
      console.log(`'Error deleting share', ${err}`);
      handleOpenSnackBar(`Error deleting share: ${err}`, "error");
    }
  };

  const getLinkFromShare = async (linkUuid) => {
    await navigator.clipboard.writeText(
      FRONT_END_HOST + "/google/l/" + linkUuid
    );
    handleOpenSnackBar(`Link has been copied to clipboard.`, "info");
  };

  if (!storedAuthSig.sig || token === "") {
    return (
      <section className={"service-grid-container"}>
        <Card className={"service-grid-login"}>
          <CardContent className={"login-container-top"}>
            <span className={"login-service"}>
              <Avatar sx={{ width: 60, height: 60 }}>G</Avatar>
              <div>
                <h2 className={"service-title"}>Google Drive</h2>
                <p className={"service-category"}>Productivity</p>
              </div>
            </span>
            {!storedAuthSig["sig"] ? (
              <p>Login with your wallet to proceed.</p>
            ) : (
              // <Button
              //   className={"service-launch-button"}
              //   variant={"contained"}
              //   onClick={() => authenticate("google")}
              // >
              //   Launch
              // </Button>
              <img
                src={googleLoginButton}
                className="service-launch-button-google"
                onClick={() => authenticate("google")}
              />
            )}
          </CardContent>
          <CardContent class={"service-description"}>
            <p>
              Create permissions based on wallet contents for your
              already-existing Google Drive files. Our flexible permissions
              builders allows you to allow access based on token or NFT
              ownership as well as other wallet attributes, like membership in a
              DAO.
            </p>
            <p>
              Once files are permissioned on the Lit Google Docs App, you can
              edit wallet parameters, view/edit access, and delete it from the
              app which removes that access.
            </p>
            <p>
              Wallets that meet the conditions will enter their email address
              for access.
            </p>
            <p>
              Sign in with Google above to connect your Google Drive account
            </p>
          </CardContent>
        </Card>
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
        <GoogleLinks
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
      <GoogleProvisionAccessModal
        handleCancelProvisionAccessDialog={handleCancelProvisionAccessDialog}
        accessControlConditions={accessControlConditions}
        removeIthAccessControlCondition={removeIthAccessControlCondition}
        setAccessControlConditions={setAccessControlConditions}
        humanizedAccessControlArray={humanizedAccessControlArray}
        handleAddAccessControl={handleAddAccessControl}
        handleGetShareLink={handleGetShareLink}
        accessToken={token}
        authSig={storedAuthSig}
        file={file}
        setFile={setFile}
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
          sharingItems={[{ name: file.embedUrl }]}
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
