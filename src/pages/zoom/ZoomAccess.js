import { useParams } from "react-router-dom";
import { Button } from "@consta/uikit/Button";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import { getResourceIdForMeeting } from "./utils";
import { getShares } from "./api";

export default function ZoomAccess() {
  let { meetingId } = useParams();

  const handleConnectAndJoin = async () => {
    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });

    const shares = (
      await getShares({
        authSig,
        meetingId,
      })
    ).shares;

    // get jwt from lit protocol to verify access control condition
    const resourceId = getResourceIdForMeeting({ id: meetingId });

    let jwt;
    // try all shares until we get a proper signed token
    for (let i = 0; i < shares.length; i++) {
      console.log("getting jwt for share", shares[i]);
      try {
        jwt = await window.litNodeClient.getSignedToken({
          accessControlConditions: shares[i].accessControlConditions,
          chain: shares[i].accessControlConditions[0].chain,
          authSig,
          resourceId,
        });
      } catch (e) {
        if (e.errorCode && e.errorCode === "not_authorized") {
          //swallow because we are going to try more shares
        } else {
          throw e;
        }
      }
      console.log(`got jwt from lit for share ${shares[i].id}`, jwt);

      if (jwt) {
        break;
      }
    }

    // submit jwt to backend to get zoom url
  };

  return (
    <Button
      label="Connect Wallet and Join Zoom Meeting"
      onClick={handleConnectAndJoin}
    />
  );
}
