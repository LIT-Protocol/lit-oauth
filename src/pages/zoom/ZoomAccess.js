import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import LitJsSdk from "lit-js-sdk";
import { getResourceIdForMeeting } from "./utils";
import { getShares, getMeetingUrl, getSingleShare } from "./zoomAsyncHelpers";
import { useAppContext } from "../../context";
import { Alert, Button, Card, CardActions, CardContent, CircularProgress, Snackbar } from "@mui/material";

export default function ZoomAccess() {
  let { meetingId } = useParams();
  const { setGlobalError, tokenList, performWithAuthSig } = useAppContext();
  const [meeting, setMeeting] = useState(null);
  const [litProtocolReady, setLitProtocolReady] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({});

  document.addEventListener(
    "lit-ready",
    function (e) {
      console.log("LIT network is ready");
      setLitProtocolReady(true);
    },
    false
  );

  useEffect(() => {
    if (meetingId === "undefined") {
      setGlobalError({
        title: "Error: Undefined meeting id",
        details: "Please make sure you entered the correct URL",
      });
    }
    console.log('MEETING ID', meetingId)
  }, [meetingId]);

  useEffect(() => {
    const getMeetingInfo = async () => {
      const meetingData = await getSingleShare(meetingId);
      setMeeting(meetingData.data[0]);
    }

    if (!meeting) {
      getMeetingInfo();
    }

  }, [meeting])

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpenSnackbar(false);
  };

  const handleOpenSnackBar = (message, severity) => {
    setSnackbarInfo({
      message: message,
      severity: severity,
    });
    setOpenSnackbar(true);
  };


  const showNotAuthorizedMessage = async ({ shares }) => {
    const humanized = [];
    for (let i = 0; i < shares.length; i++) {
      const share = shares[i];
      console.log("humanizing share", share);
      humanized.push(
        await LitJsSdk.humanizeAccessControlConditions({
          unifiedAccessControlConditions: share.accessControlConditions,
          tokenList,
        })
      );
    }
    setGlobalError({
      title:
        "Unable to join meeting.  You probably don't meet the access control conditions below",
      details: humanized.map((f, i) => <div key={i}>{f}</div>),
    });
  };

  const handleConnectAndJoin = async () => {
    await performWithAuthSig(async (authSig) => {
      console.log("authSig when granting access", authSig);
      const shares = (
        await getShares({
          authSig,
          meetingId,
        })
      ).shares;

      console.log("shares", shares);

      // get jwt from lit protocol to verify access control condition

      let jwt;
      let share;
      // try all shares until we get a proper signed token
      for (let i = 0; i < shares.length; i++) {
        share = shares[i];
        console.log("getting jwt for share", share);
        const resourceId = getResourceIdForMeeting({
          meeting: { id: share.id },
          share,
        });

        try {
          jwt = await window.litNodeClient.getSignedToken({
            accessControlConditions: share.accessControlConditions,
            chain: share.accessControlConditions[0].chain,
            authSig,
            resourceId,
          });
        } catch (e) {
          if (e.errorCode && e.errorCode === "not_authorized") {
            //swallow because we are going to try more shares
            console.log("not authorized, trying more shares");
          } else {
            throw e;
          }
        }
        console.log(`got jwt from lit for share ${shares[i].id}`, jwt);

        if (jwt) {
          break;
        }
      }

      if (!jwt) {
        await showNotAuthorizedMessage({ shares });
        return;
      }

      // submit jwt to backend to get zoom url
      const data = await getMeetingUrl({
        assetType: share.assetType,
        shareId: share.id,
        assetIdOnService: share.assetIdOnService,
        jwt,
      });

      console.log('DATA', data)

      if (!data.joinUrl) {
        if (data.errorCode && data.errorCode === "not_authorized") {
          await showNotAuthorizedMessage({ shares });
        } else {
          console.log(data);
          setGlobalError({
            title: "Sorry, an unknown error occured",
            details: "Please email support@litprotocol.com with a bug report.",
          });
        }
        return;
      }

      const { joinUrl } = data;

      console.log("joinUrl", joinUrl);

      window.location = joinUrl;
    });
  };

  if (!litProtocolReady && !meeting) {
    return (
      <>
        <h3>Connecting to Lit Protocol, please wait...</h3>
        <CircularProgress/>
      </>
    );
  }

  return (
    <section className={'access-service-card-container'}>
      <Card className={'access-service-card'}>
        <CardContent className={'access-service-card-header'}>
          <span className={'access-service-card-header-left'}>
            <div style={{ backgroundImage: `url('/appslogo.svg')` }} className={'access-service-card-logo'}/>
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
          <p>You have been invited to join the Zoom meeting <strong>{meeting.name}</strong></p>
          {/*<p>The scheduled start time is <strong>{}</strong></p>*/}
        </CardContent>
        <CardActions className={'access-service-card-actions'} style={{ padding: '0' }}>
          <span className={'access-service-card-launch-button'} onClick={handleConnectAndJoin}>
            Connect Wallet
            <svg width="110" height="23" viewBox="0 0 217 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.576416 20.9961H212.076L184.076 1.99609" stroke="white" strokeWidth="3"/>
            </svg>
          </span>
        </CardActions>
      </Card>
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        open={openSnackbar}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
      </Snackbar>
    </section>
  );
}
