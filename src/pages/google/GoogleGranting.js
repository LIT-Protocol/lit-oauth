import React, { useEffect, useState } from "react";
import ShareModal from "lit-share-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader.js";
import GoogleLinks from "./GoogleGrantingComponents/GoogleLinks";
import GoogleProvisionAccessModal from "./GoogleGrantingComponents/GoogleProvisionAccessModal";
import { Alert, CircularProgress, Snackbar } from "@mui/material";

import "./GoogleGranting.scss";
import "../../../node_modules/lit-share-modal/dist/style.css";
import * as asyncHelpers from "./googleAsyncHelpers.js";
import { useAppContext } from "../../context";
import LitProtocolConnection from "../sharedComponents/litProtocolConnection/LitProtocolConnection";
import BackToApps from "../sharedComponents/backToApps/BackToApps";
import {
  checkIfUserExists,
  getUserProfile,
  signOutUser,
} from "./googleAsyncHelpers.js";

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
  const [currentClient, setCurrentClient] = useState(null);
  const [allShares, setAllShares] = useState([]);
  const [accessToken, setAccessToken] = useState("");
  const [connectedServiceId, setConnectedServiceId] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [role, setRole] = useState("reader");
  const [currentUser, setCurrentUser] = useState({});
  const [storedAuthSig, setStoredAuthSig] = useState({});
  const [permanent, setPermanent] = useState(true);
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
    await handleSubmit();
    setOpenProvisionAccessDialog(false);
    setFile(null);
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
    let client;
    await performWithAuthSig(async (authSig) => {
      await setStoredAuthSig(authSig);
      console.log("authSig", authSig);

      if (!storedAuthSig || !storedAuthSig["sig"]) {
        console.log("Stop auth if authSig is not yet available");
      }

      const userExists = await checkIfUserExists(authSig);
      console.log("check frontend userExists", userExists);

      const stringifiedAuthSig = JSON.stringify(authSig);

      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_KEY,
        scope:
          "https://www.googleapis.com/auth/drive.file openid https://www.googleapis.com/auth/userinfo.email",
        ux_mode: "redirect",
        redirect_uri: `${API_HOST}/api/oauth/google/callback`,
        state: stringifiedAuthSig,
      });

      setCurrentClient(client);

      if (!userExists.data) {
        // if no google user exists, redirect to authenticate
        client.requestCode();
      } else {
        await handleLoadCurrentUser(authSig);
      }
    });
  };

  const handleLoadCurrentUser = async (authSig) => {
    const userInfo = await getUserProfile(authSig);
    // check for google drive scope and sign user out if scope is not present
    if (
      userInfo.data["scope"] &&
      userInfo.data["scope"].includes(
        "https://www.googleapis.com/auth/drive.file"
      )
    ) {
      try {
        const profileData = JSON.parse(userInfo.data.extraData);
        const userProfile = {
          idOnService: userInfo.data.idOnService,
          email: userInfo.data.email,
          displayName: profileData.displayName,
          avatar: profileData.photoLink,
        };

        await getAllShares(authSig, userProfile.idOnService);
        setCurrentUser(userProfile);
        setAccessToken(userInfo.data.accessToken);
      } catch (err) {
        console.log("No user found locally:", err);
        handleOpenSnackBar(`No user found locally: ${err}`, "error");
      }
    } else {
      console.log(
        `Insufficient Permission: Request had insufficient authentication scopes.`,
        "error"
      );
      handleOpenSnackBar(
        `Insufficient Permission: Request had insufficient authentication scopes.`,
        "error"
      );
      await callSignOut();
    }
  };

  const onPickerApiLoad = () => {
    console.log("Google Picker Loaded");
  };

  const getAuthSig = async () => {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  };

  const getAllShares = async (authSig, idOnService) => {
    const allSharesHolder = await asyncHelpers.getAllShares(
      authSig,
      idOnService
    );

    const humanizeAccPromiseArray = allSharesHolder.data.map((s) => {
      const shareAcConditions = JSON.parse(s.accessControlConditions);
      return LitJsSdk.humanizeAccessControlConditions({
        accessControlConditions: shareAcConditions,
        myWalletAddress: storedAuthSig.address,
      });
    });

    Promise.all(humanizeAccPromiseArray).then((humanizedAcc) => {
      let combinedAllShares = [];
      for (let i = 0; i < allSharesHolder.data.length; i++) {
        let singleShare = allSharesHolder.data[i];
        singleShare["humanizedAccessControlConditions"] = humanizedAcc[i];
        combinedAllShares.push(singleShare);
      }
      setAllShares(combinedAllShares.reverse());
    });
  };

  const callSignOut = async () => {
    setAccessControlConditions([]);
    setAccessToken("");
    setCurrentUser({});
    setConnectedServiceId("");
    await signOutUser(storedAuthSig);
    window.location = `https://litgateway.com/apps`;
  };

  const addToAccessControlConditions = async (r) => {
    setPermanent(r.permanent);
    const concatAccessControlConditions = accessControlConditions.concat(
      r.accessControlConditions
    );
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
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    const requestData = {
      driveId: file.id,
      role: role,
      token: accessToken,
      connectedServiceId: connectedServiceId,
      accessControlConditions: accessControlConditions,
      authSig,
      idOnService: currentUser.idOnService,
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
        permanent,
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
    } catch (err) {
      console.log(`'Error sharing share', ${err}`);
      handleOpenSnackBar(`'Error sharing share', ${err}`, "error");
    }
  };

  const handleDeleteShare = async (shareInfo) => {
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
    await navigator.clipboard.writeText(
      FRONT_END_HOST + "/google/l/" + linkUuid
    );
    handleOpenSnackBar(`Link has been copied to clipboard.`, "info");
  };

  return (
    <div>
      <BackToApps />
      {(!storedAuthSig["sig"] || accessToken === "") &&
      !currentUser["idOnService"] ? (
        <div className={"service-loader"}>
          <CircularProgress />
          <h3>Waiting for Google Account</h3>
        </div>
      ) : (
        <section className={"service-grid-container"}>
          <div className={"service-grid-header"}>
            <ServiceHeader
              serviceName={"Google Drive App"}
              oauthServiceProvider={"Google"}
              currentUser={currentUser}
              serviceImageUrl={"/googledrive.png"}
              signOut={callSignOut}
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
              authSig={storedAuthSig}
            />
          </div>
          <GoogleProvisionAccessModal
            handleCancelProvisionAccessDialog={
              handleCancelProvisionAccessDialog
            }
            accessControlConditions={accessControlConditions}
            removeIthAccessControlCondition={removeIthAccessControlCondition}
            setAccessControlConditions={setAccessControlConditions}
            humanizedAccessControlArray={humanizedAccessControlArray}
            handleAddAccessControl={handleAddAccessControl}
            handleGetShareLink={handleGetShareLink}
            accessToken={accessToken}
            authSig={storedAuthSig}
            file={file}
            setFile={setFile}
            role={role}
            setRole={setRole}
            roleMap={googleRoleMap}
            openProvisionAccessDialog={openProvisionAccessDialog}
            setOpenProvisionAccessDialog={setOpenProvisionAccessDialog}
          />
          <LitProtocolConnection
            className={"lit-protocol-connection"}
            connection={!!storedAuthSig["sig"]}
          />
          {navigator.brave && navigator.brave.isBrave() && (
            <span className={"braveNotification"}>
              If using Brave Browser, popups and redirects will have to be
              allowed in order for this site to work correctly.
            </span>
          )}
        </section>
      )}
      {openShareModal && (
        <ShareModal
          onClose={() => setOpenShareModal(false)}
          showModal={openShareModal}
          injectCSS={false}
          onAccessControlConditionsSelected={async (restriction) => {
            console.log("check restriction", restriction);
            await addToAccessControlConditions(restriction);
            setOpenShareModal(false);
            setOpenProvisionAccessDialog(true);
          }}
        />
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
  );
}
