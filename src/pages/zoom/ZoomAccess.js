import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import LitJsSdk from "lit-js-sdk";
import { getResourceIdForMeeting } from "./utils";
import { getShares, getMeetingUrl } from "./zoomAsyncHelpers";
import { useAppContext } from "../../context";
import { Button, CircularProgress } from "@mui/material";

export default function ZoomAccess() {
  let { meetingId } = useParams();
  const { setGlobalError, tokenList, performWithAuthSig } = useAppContext();
  const [litProtocolReady, setLitProtocolReady] = useState(false);

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

  const showNotAuthorizedMessage = async ({ shares }) => {
    const humanized = [];
    for (let i = 0; i < shares.length; i++) {
      const share = shares[i];
      console.log("humanizing share", share);
      humanized.push(
        await LitJsSdk.humanizeAccessControlConditions({
          accessControlConditions: share.accessControlConditions,
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
      // console.log("authSig when granting access", authSig);
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
          meeting: { id: meetingId },
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
        meetingId,
        shareId: share.id,
        jwt,
      });

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

  if (!litProtocolReady) {
    return (
      <>
        <h3>Connecting to Lit Protocol, please wait...</h3>
        <CircularProgress/>
      </>
    );
  }

  return (
    <>
      <Button variant={'outlined'}
              onClick={handleConnectAndJoin}
      >Connect Wallet and Join Zoom Meeting</Button>
    </>
  );
}
