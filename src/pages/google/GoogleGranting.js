import { useEffect, useState } from "react";
import { ShareModal } from "lit-access-control-conditions-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader.js";
import GoogleLinks from "./GoogleGrantingComponents/GoogleLinks";
import GoogleProvisionAccessModal from "./googleProvisionAccessModal/GoogleProvisionAccessModal";
import {
  Alert,
  Button,
  Card,
  Snackbar,
  IconButton,
  CardContent, CircularProgress,
} from "@mui/material";
// import googleDriveLogo from '../../assets/googledrive.png';
import googleLoginButton from "../../assets/btn_google_signin_dark_normal_web@2x.png";

import "./GoogleGranting.scss";
import * as asyncHelpers from "./googleAsyncHelpers.js";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAppContext } from "../../context";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
const GOOGLE_CLIENT_KEY =
  process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;

const googleRoleMap = {
  Read: "reader",
  Comment: "commenter",
  Write: "writer",
};

export default function GoogleGranting(props) {
  const parsedEnv = dotenv.config();
  const { performWithAuthSig } = useAppContext();

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
    if (!!performWithAuthSig) {
      loadAuth();
    }
  }, [performWithAuthSig]);

  useEffect(() => {
    const humanizeAccessControlConditions = async () => {
      return await LitJsSdk.humanizeAccessControlConditions({
        accessControlConditions,
        myWalletAddress: storedAuthSig.address,
      });
    };

    console.log('ACCONDITI', accessControlConditions)

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
    await performWithAuthSig(async (authSig) => {
      await setStoredAuthSig(authSig);

      if (!storedAuthSig || !storedAuthSig['sig']) {
        console.log('Stop auth if authSig is not yet available');
        return;
      }
      console.log('AuthSIg', storedAuthSig)
      window.gapi.load("client:auth2", function () {
        window.gapi.auth2
          .init({
            client_id: GOOGLE_CLIENT_KEY,
            scope: "https://www.googleapis.com/auth/drive.file",
          }).then(async (googleObject) => {
            window.gapi.load("picker", {callback: onPickerApiLoad});
            const userIsSignedIn = googleObject.isSignedIn.get();
            if (!userIsSignedIn) {
              // if no google user exists, push toward authenticate
              await authenticate();
            } else {
              // if a google user does exist, load user from lit DB
              const currentUserObject = window.gapi.auth2
                .getAuthInstance()
                .currentUser.get();
              await handleLoadCurrentUser(currentUserObject);
            }
        })
      })
    })
  };

  const handleLoadCurrentUser = async (currentUserObject) => {
    const grantedScopes = currentUserObject.getGrantedScopes();
    // check for google drive scope and sign user out if scope is not present
    if (grantedScopes.includes("https://www.googleapis.com/auth/drive.file")) {
      try {
        const idOnService = currentUserObject.getId();
        const currentLitUserProfile = await checkForCurrentLitUser(storedAuthSig, idOnService);

        if (currentLitUserProfile[0]) {
          await setLatestAccessToken(currentUserObject, idOnService);
        } else {
          console.log('No user found locally. Please log in again.')
          handleOpenSnackBar(`No user found locally. Please log in again.`, 'error');
          await authenticate();
        }
      } catch(err) {
        console.log('No user found locally:', err)
        handleOpenSnackBar(`No user found locally: ${err}`, 'error');
      }
    } else {
      console.log(`Insufficient Permission: Request had insufficient authentication scopes.`, 'error');
      handleOpenSnackBar(`Insufficient Permission: Request had insufficient authentication scopes.`, 'error');
      await signOut();
    }
  };

  const checkForCurrentLitUser = async (authSig, idOnService) => {
    try {
      const userProfiles = await asyncHelpers.getLitUserProfile(
        authSig,
        idOnService
      );
      return userProfiles.data;
    } catch(err) {
      console.log('No user found locally:', err)
      handleOpenSnackBar(`No user found locally: ${err}`, 'error');
      return [];
    }
  }

  const setLatestAccessToken = async (currentUserObject, idOnService) => {
    const googleAuthResponse = currentUserObject.getAuthResponse();
    try {
      const response = await asyncHelpers.verifyToken(
        storedAuthSig,
        googleAuthResponse, idOnService
      );
      console.log('VERIFY TOKEN RESPONSE', response)
      setConnectedServiceId(response.data.connectedServices[0].id);
      setToken(googleAuthResponse.access_token);
      await setUserProfile(currentUserObject);
      await getAllShares(storedAuthSig, idOnService);
    } catch (err) {
      console.log("Error verifying user:", err);
      handleOpenSnackBar(`Error verifying user:, ${err}`, "error");
    }
  };

  const authenticate = async () => {
    try {
      const authResult = await window.gapi.auth2
        .getAuthInstance()
        .grantOfflineAccess({
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      if (authResult.code) {
        await storeToken(storedAuthSig, authResult.code);
      }
    } catch(err) {
      if (err.error === 'popup_blocked_by_browser') {
        handleOpenSnackBar(`Pop up was blocked by browser, please enable popups to continue.`, 'error');
      } else {
        handleOpenSnackBar(`Error logging in: ${err}`, 'error');
        console.log('Error logging in:', err)
      }
    }
  };

  const setUserProfile = async (currentUserObject) => {
    const userBasicProfile = currentUserObject.getBasicProfile();
    // TODO: replace with google user photo
    const avatar = userBasicProfile.getName()
      .split(" ")
      .map((s) => s.split("")[0])
      .join("");

    const userProfile = {
      idOnService: userBasicProfile.getId(),
      email: userBasicProfile.getEmail(),
      displayName: userBasicProfile.getName(),
      givenName: userBasicProfile.getGivenName(),
      avatar: userBasicProfile.getImageUrl(),
    };
    setCurrentUser(userProfile);
  }

  const onPickerApiLoad = () => {
    console.log("Google Picker Loaded");
  };

  const getAuthSig = async () => {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  };

  const getAllShares = async (authSig, idOnService) => {
    const allSharesHolder = await asyncHelpers.getAllShares(authSig, idOnService);
    setAllShares(allSharesHolder.data.reverse());
  };

  const storeToken = async (authSig, token) => {
    try {
      const response = await asyncHelpers.storeConnectedServiceAccessToken(
        authSig,
        token
      );
      if (response.data["errorStatus"]) {
        handleOpenSnackBar(
          `Error logging in: ${response.data.errors[0]["message"]}`,
          "error"
        );
        await signOut();
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
        const idOnService = currentUserObject.getId();

        const token = await currentUserObject.getAuthResponse(true);
        console.log("ACCESS_TOKEN", token);
        setToken(token.access_token);
        console.log(
          "currentUserObject after getting auth response with tokens",
          currentUserObject
        );
        await setUserProfile(currentUserObject)
        await getAllShares(storedAuthSig, idOnService);
      }
    } catch (err) {
      console.log(`Error storing access token:, ${err.errors}`, err);
      handleOpenSnackBar(`Error storing access token:, ${err}`, "error");
      // await signOut();
    }
  };

  const signOut = async () => {
    setAccessControlConditions([]);
    setToken("");
    setCurrentUser({});
    const auth2 = await window.gapi.auth2.getAuthInstance();
    await auth2.signOut().then(function () {
      auth2.disconnect();
      window.location = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}`;
    });
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
    console.log('CURRENT USER IN HANDLE SUBMIT', currentUser)
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
      idOnService: currentUser.idOnService
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
      await getAllShares(storedAuthSig, currentUser.idOnService);
    } catch(err) {
      console.log(`'Error sharing share', ${err}`)
      handleOpenSnackBar(`'Error sharing share', ${err}`, 'error');
    }
  };

  const handleDeleteShare = async (shareInfo) => {
    console.log('USER DATA IN DELETE SHARE', currentUser)
    try {
      await asyncHelpers.deleteShare(shareInfo.id);
      await getAllShares(storedAuthSig, currentUser.idOnService);
      handleOpenSnackBar(`${shareInfo.name} has been deleted.`, "success");
    } catch (err) {
      console.log(`'Error deleting share', ${err}`);
      handleOpenSnackBar(`Error deleting share: ${err}`, "error");
    }
  };

  const getLinkFromShare = async (linkUuid) => {
    await navigator.clipboard.writeText(FRONT_END_HOST + "/google/l/" + linkUuid)
    handleOpenSnackBar(`Link has been copied to clipboard.`, 'info');
  }

  return (
    <div>
      {(!storedAuthSig['sig'] || token === "") ? (
        <div className={'service-loader'}>
          <CircularProgress/>
          <h3>Working...</h3>
        </div>
      ) : (
        <section className={"service-grid-container"}>
          <Button aria-label="delete" size="large" startIcon={<ArrowBackIcon/>} onClick={() => window.location = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}`}>
            Back to all Apps
          </Button>
          <div className={'service-grid-header'}>
            <ServiceHeader
              serviceName={"Google Drive App"}
              oauthServiceProvider={"Google"}
              currentUser={currentUser}
              serviceImageUrl={'/googledrive.png'}
              signOut={signOut}
            />
          </div>
          <div className={'service-grid-links'}>
            <GoogleLinks
              className={"service-links"}
              serviceName={"Drive"}
              handleOpenProvisionAccessDialog={handleOpenProvisionAccessDialog}
              handleEditLinkAction={() => console.log('EDIT CLICKED')}
              handleCopyLinkAction={(linkUuid) => getLinkFromShare(linkUuid)}
              handleDownloadLinkAction={() => console.log('DOWNLOAD CLICKED')}
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
        </section>
      )}
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
      </Snackbar>
    </div>
  )
}
