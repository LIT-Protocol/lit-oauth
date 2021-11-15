import React, { useEffect, useState } from "react";
import LitJsSdk from "lit-js-sdk";
import axios from "axios";
import { Alert, Button, Card, CardActions, CardContent, CardHeader, Snackbar, TextField, } from "@mui/material";
import "./GoogleLinkShare.scss";

const GOOGLE_CLIENT_KEY =
  process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_URI = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;

function GoogleLinkShare() {
  const [conditionsFetched, setConditionsFetched] = useState(false);
  const [error, setError] = useState("");
  const [litNodeClient, setLitNodeClient] = useState({});
  const [linkData, setLinkData] = useState(null);
  const [email, setEmail] = useState("");
  const [uuid, setUuid] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({});

  // gapi.load("client:auth2", function () {
  //   gapi.auth2.init({
  //     client_id: GOOGLE_CLIENT_KEY,
  //     scope: "https://www.googleapis.com/auth/drive.file",
  //   });
  // });

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpenSnackbar(false);
  };

  useEffect(() => {
    console.log('SHARE TEST', linkData)
    if (conditionsFetched === false) {
      const uuid = /[^/]*$/.exec(window.location.pathname)[0];
      setUuid(uuid);
      const body = JSON.stringify({uuid: uuid});
      const headers = {"Content-Type": "application/json"};
      axios
        .post(`${BASE_URL}/api/google/conditions`, body, {headers})
        .then(async (res) => {
          console.log("OUT THROUGH CONDITIONS", res.data);

          let litNodeClient = new LitJsSdk.LitNodeClient();
          await litNodeClient.connect();
          setLitNodeClient(litNodeClient);
          console.log('GOOGLE LINK DATA', res.data.share);
          console.log(typeof res.data["role"]);
          setLinkData(res.data.share);
          setConditionsFetched(true);
        })
        .catch((err) => {
          setError("Invalid link");
        });
    }
  }, []);

  const provisionAccess = async () => {
    const accessControlConditions = JSON.parse(
      linkData.accessControlConditions
    );

    const chain = accessControlConditions[0].chain;
    const resourceId = {
      baseUrl: BASE_URL,
      path: "/google/l/" + uuid,
      orgId: "",
      role: linkData["role"].toString(),
      extraData: "",
    };

    const authSig = await LitJsSdk.checkAndSignAuthMessage({chain});

    console.log("BEFORE FINAL SAVE", {
      accessControlConditions: accessControlConditions,
      chain,
      authSig: authSig,
      resourceId: resourceId,
    });

    const jwt = await litNodeClient.getSignedToken({
      accessControlConditions: accessControlConditions,
      chain,
      authSig: authSig,
      resourceId: resourceId,
    });

    return jwt;
  }

  // const handleDelete = () => {
  //   return gapi.auth2
  //     .getAuthInstance()
  //     .grantOfflineAccess()
  //     .then(async (authResult) => {
  //       if (authResult.code) {
  //         const body = JSON.stringify({
  //           uuid: uuid,
  //           token: authResult.code,
  //         });
  //         const headers = { "Content-Type": "application/json" };
  //         axios
  //           .post(`${BASE_URL}/api/google/delete`, body, { headers })
  //           .then((res) => {
  //             if (res.status === 500) {
  //               setError(
  //                 "Error deleting link; were you the creator of this link?"
  //               );
  //             } else {
  //               setError("Successfully deleted this link.");
  //             }
  //           })
  //           .catch(() =>
  //             setError(
  //               "Error deleting link; were you the creator of this link?"
  //             )
  //           );
  //       } else {
  //         setError("Error logging in");
  //       }
  //     });
  // };

  const getFileTypeUrl = (fileType) => {
    console.log("fileType", fileType);
    let fileTypeUrl;
    if (fileType.includes("audio") || fileType.includes("mpeg")) {
      fileTypeUrl = "file";
    } else if (fileType.includes("document")) {
      fileTypeUrl = "document";
    } else if (fileType.includes("spreadsheet")) {
      fileTypeUrl = "spreadsheets";
    } else if (fileType.includes("presentation")) {
      fileTypeUrl = "presentation";
    } else if (fileType.includes("form")) {
      fileTypeUrl = "forms";
    }
    return fileTypeUrl;
  };

  const handleSubmit = async () => {
    provisionAccess().then(async (jwt) => {
      const role = linkData["role"];
      const body = {email, role, uuid, jwt};
      const headers = {"Content-Type": "application/json"};
      try {
        const shareLinkResponse = await axios.post(`${BASE_URL}/api/google/shareLink`, body, {headers});
        console.log("DATA", shareLinkResponse);
        console.log(
          "LINK",
          `https://docs.google.com/${getFileTypeUrl(
            linkData.assetType
          )}/d/${shareLinkResponse.data.fileId}`
        );
        window.location = `https://docs.google.com/${getFileTypeUrl(
          linkData.assetType
        )}/d/${shareLinkResponse.data.fileId}`;
      } catch (err) {
        console.log('An error occurred while accessing link:', err)
        setSnackbarInfo({
          message: `An error occurred while accessing link: ${err}`,
          severity: 'error'
        })
        setOpenSnackbar(true);
      }
    });
  };

  if (error !== "") {
    return <div>{error}</div>;
  }

  if (conditionsFetched === false || !linkData) {
    return <div>Getting data...</div>;
  } else {
    return (
      <section className={'access-service-card-container'}>
        <Card className={'access-service-card'}>
          <CardContent className={'access-service-card-header'}>
          <span className={'access-service-card-header-left'}>
            <div style={{ backgroundImage: `url('/appslogo.svg')`}} className={'access-service-card-logo'}/>
            <div className={'access-service-card-title'}>
              <h2>Lit Apps</h2>
              <p>The power of blockchain-defined access combine with your current tool suite.</p>
            </div>
          </span>
            <span className={'access-service-card-header-right'}>
            <p>Find more apps on the <strong>Lit Gateway</strong></p>
          </span>
          </CardContent>
          <CardContent className={'access-service-card-content'}>
            {/*<div className={'access-service-card-content-left'}></div>*/}
            {/*<div className={'access-service-card-content-right'}></div>*/}
            <section className={'access-service-card-google-content'}>
              <p>You have been invited to view a file on Google Drive.</p>
              <p>Title: <strong>{linkData.name}</strong></p>
              <p>Type: <strong>{linkData.assetType}</strong></p>
              <p>Permission: <strong>{linkData.role}</strong></p>
              <p>Enter your email to additionally receive a copy of the link.</p>
                <TextField
                  fullWidth
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                />
            </section>
          </CardContent>
          <CardActions className={'access-service-card-actions'} style={{padding: '0'}}>
          <span className={'access-service-card-launch-button'} onClick={handleSubmit}>
            Connect Wallet
            <svg width="110" height="23" viewBox="0 0 217 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.576416 20.9961H212.076L184.076 1.99609" stroke="white" strokeWidth="3"/>
            </svg>
          </span>
          </CardActions>
        </Card>
        <Snackbar
          anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
          open={openSnackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
        </Snackbar>
      </section>
    );
  }
}

export default GoogleLinkShare;
