import { useState, useEffect } from "react";
import LitJsSdk from "lit-js-sdk";
import axios from "axios";
import {
  Button,
  Card,
  CardActions,
  CardHeader,
  CardContent,
  TextField, Snackbar, Alert,
} from "@mui/material";
import "./GoogleLinkShare.scss";

const GOOGLE_CLIENT_KEY =
  process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_URI = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;

function GoogleLinkShare() {
  const [conditionsFetched, setConditionsFetched] = useState(false);
  const [error, setError] = useState("");
  const [litNodeClient, setLitNodeClient] = useState({});
  const [linkData, setLinkData] = useState([]);
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
    if (conditionsFetched === false) {
      const uuid = /[^/]*$/.exec(window.location.pathname)[0];
      setUuid(uuid);
      const body = JSON.stringify({ uuid: uuid });
      const headers = { "Content-Type": "application/json" };
      axios
        .post(`${BASE_URL}/api/google/conditions`, body, { headers })
        .then(async (res) => {
          console.log("OUT THROUGH CONDITIONS", res.data);
          setConditionsFetched(true);

          let litNodeClient = new LitJsSdk.LitNodeClient();
          await litNodeClient.connect();
          setLitNodeClient(litNodeClient);
          console.log(res.data["requirements"]);
          console.log(typeof res.data["role"]);
          setLinkData(res.data);
        })
        .catch((err) => {
          setError("Invalid link");
        });
    }
  }, []);

  const provisionAccess = async () => {
    const accessControlConditions = JSON.parse(
      linkData.share.accessControlConditions
    );

    const chain = accessControlConditions[0].chain;
    const resourceId = {
      baseUrl: BASE_URL,
      path: "/google/l/" + uuid,
      orgId: "",
      role: linkData.share["role"].toString(),
      extraData: "",
    };

    const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain });

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
      const role = linkData.share["role"];
      const body = { email, role, uuid, jwt };
      const headers = { "Content-Type": "application/json" };
      try {
        const shareLinkResponse = await axios.post(`${BASE_URL}/api/google/shareLink`, body, { headers });
        console.log("DATA", shareLinkResponse);
        console.log(
          "LINK",
          `https://docs.google.com/${getFileTypeUrl(
            linkData.share.assetType
          )}/d/${shareLinkResponse.data.fileId}`
        );
        window.location = `https://docs.google.com/${getFileTypeUrl(
          linkData.share.assetType
        )}/d/${shareLinkResponse.data.fileId}`;
      } catch(err) {
        console.log('An error occurred while accessing link:', err)
        setSnackbarInfo({
          message: `An error occurred while accessing link: ${err}`,
          severity: 'error'
        })
        setOpenSnackbar(true);
      }
      // axios
      //   .post(`${BASE_URL}/api/google/shareLink`, body, { headers })
      //   .then((data) => {
      //     window.location = `https://docs.google.com/${getFileTypeUrl(
      //       linkData.share.assetType
      //     )}/d/${data.data.fileId}`;
      //     console.log("DATA", data);
      //     console.log(
      //       "LINK",
      //       `https://docs.google.com/${getFileTypeUrl(
      //         linkData.share.assetType
      //       )}/d/${data.data.fileId}`
      //     );
      //   })
      //   .catch((err) => {
      //     console.log('Error navigating to link.')
      // });
    });
  };

  if (error !== "") {
    return <div>{error}</div>;
  }

  if (conditionsFetched === false) {
    return <div>Getting data...</div>;
  } else {
    return (
      <section>
        <Card className={"request-link-card"}>
          {/*<ServiceHeader/>*/}
          <CardHeader
            title={"Enter your Google Account email to access this file"}
          />
          {/*  Enter your Google Account email here*/}
          {/*</CardHeader>*/}
          <CardContent>
            <TextField
              fullWidth
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
            />
          </CardContent>
          <CardActions className={"request-link-actions"}>
            {/* <Button
              variant={"outlined"}
              label="Delete This Link"
              className="top-margin-buffer"
              type="button"
              onClick={handleDelete}
            >
              Delete This Link
            </Button> */}
            <Button
              disabled={!email.length}
              variant={"outlined"}
              label="Request Access"
              className="top-margin-buffer"
              type="button"
              onClick={handleSubmit}
            >
              View File
            </Button>
          </CardActions>
          {/*<div className={"vertical-flex top-margin-buffer"}>*/}
          {/*  <label>Enter your Google Account email here*/}
          {/*    <input*/}
          {/*      type="text"*/}
          {/*      name="email-input"*/}
          {/*      id="email-input"*/}
          {/*      onChange={(e) => setEmail(e.target.value)}*/}
          {/*    />*/}
          {/*  </label>*/}
          {/*</div>*/}
        </Card>
        <Snackbar
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}}
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
