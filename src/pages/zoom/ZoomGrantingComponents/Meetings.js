import React, { useEffect, useState } from "react";

import { getMeetings, createMeetingShare } from "../api";

import LitJsSdk from "lit-js-sdk";

import { ProgressSpin } from "@consta/uikit/ProgressSpin";
import { Button } from "@consta/uikit/Button";
import { SnackBar } from "@consta/uikit/SnackBar";

import { ShareModal } from "lit-access-control-conditions-modal";

import "./Meetings.css";
import { getResourceIdForMeeting, getSharingLink } from "../utils";

export default function Meetings(props) {
  const [meetings, setMeetings] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState(null);
  const [showSnackbar, setShowSnackbar] = useState(false);

  useEffect(() => {
    const go = async () => {
      const resp = await getMeetings();
      setMeetings(resp.meetings.map((m) => m.meetings).flat());
    };
    go();
  }, []);

  const handleGrantAccess = async (meeting) => {
    await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
    setCurrentMeeting(meeting);
    setShowShareModal(true);
  };

  const closeShareModal = () => {
    setShowShareModal(false);
  };

  const onAccessControlConditionsSelected = async (accessControlConditions) => {
    console.log("onAccessControlConditionsSelected", accessControlConditions);
    const chain = accessControlConditions[0].chain;

    const resp = await createMeetingShare({
      meeting: currentMeeting,
      accessControlConditions,
    });
    console.log(resp);

    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });

    const resourceId = getResourceIdForMeeting(currentMeeting);
    await window.litNodeClient.saveSigningCondition({
      accessControlConditions,
      chain,
      authSig,
      resourceId,
    });
  };

  const copyToClipboard = async (toCopy) => {
    await navigator.clipboard.writeText(toCopy);
    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 5000);
  };

  const handleCopyShareLink = (meeting) => {
    const link = getSharingLink(meeting);
    copyToClipboard(link);
  };

  return (
    <div className="Meetings">
      {meetings ? (
        meetings.map((m) => (
          <div className="Meeting" key={m.id}>
            <div className="MeetingColumn">{m.topic}</div>
            <div className="MeetingColumn">
              {new Date(m.start_time).toLocaleString()}
            </div>
            <div className="MeetingColumn">
              <Button
                view="secondary"
                label="Grant Access"
                onClick={() => handleGrantAccess(m)}
              />
              {m.shares && m.shares.length > 0 ? (
                <Button
                  label="Copy share link"
                  onClick={() => handleCopyShareLink(m)}
                />
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <ProgressSpin />
      )}

      {showShareModal ? (
        <ShareModal
          onClose={() => closeShareModal()}
          sharingItems={[currentMeeting]}
          onAccessControlConditionsSelected={onAccessControlConditionsSelected}
          getSharingLink={() => getSharingLink(currentMeeting)}
          onlyAllowCopySharingLink={false}
          copyLinkText="Only authorized users will be able to enter this Zoom meeting"
          showStep="ableToAccess"
        />
      ) : null}

      {showSnackbar ? (
        <SnackBar items={[{ key: 1, message: "Copied!" }]} />
      ) : null}
    </div>
  );
}

/* meeting example:
{
	"uuid": "AaLLqoplQwODJ98KflVM1w==",
	"id": 85609331033,
	"host_id": "wbbVH2RVRlOvpzcqtR299Q",
	"topic": "Test Meeting",
	"type": 2,
	"start_time": "2021-11-11T05:00:00Z",
	"duration": 60,
	"timezone": "America/Los_Angeles",
	"created_at": "2021-09-21T03:04:59Z",
	"join_url": "https://us02web.zoom.us/j/85609331033?pwd=WEhJRjFVaWdJZGpBOWhHZ3dhcUpkUT09"
}
*/
