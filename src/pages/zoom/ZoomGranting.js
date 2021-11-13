import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import ZoomMeetings from "./ZoomGrantingComponents/ZoomMeetings";
import { useAppContext } from "../../context";
import { Alert, CircularProgress, Snackbar } from "@mui/material";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader";
import React, { useEffect, useState } from "react";
import { createMeetingShare, getMeetingsAndWebinars, getServiceInfo, logout } from "./zoomAsyncHelpers";
import ZoomProvisionAccessModal from "./ZoomGrantingComponents/ZoomProvisionAccessModal";
import { ShareModal } from "lit-access-control-conditions-modal";
import { getResourceIdForMeeting, getSharingLink } from "./utils";
import * as asyncHelpers from "../zoom/zoomAsyncHelpers";
import LitProtocolConnection from "../sharedComponents/litProtocolConnection/LitProtocolConnection";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;

export default function ZoomGranting() {
  const {performWithAuthSig} = useAppContext();

  const [userSignedIn, setUserSignedIn] = useState(false);

  const [currentUser, setCurrentUser] = useState({})
  const [allShares, setAllShares] = useState([]);
  const [currentServiceInfo, setCurrentServiceInfo] = useState(null);
  const [storedAuthSig, setStoredAuthSig] = useState({});
  const [humanizedAccessControlArray, setHumanizedAccessControlArray] = useState([]);
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  // const [token, setToken] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetings, setMeetings] = useState([]);

  const [openShareModal, setOpenShareModal] = useState(false);
  const [openProvisionAccessDialog, setOpenProvisionAccessDialog] =
    useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({});

  useEffect(() => {
    if (!!performWithAuthSig) {
      loadAuth();
    }
  }, [performWithAuthSig, storedAuthSig]);

  useEffect(() => {
    const humanizeAccessControlConditions = async () => {
      return await LitJsSdk.humanizeAccessControlConditions({
        accessControlConditions,
        myWalletAddress: storedAuthSig.address,
      });
    }
    humanizeAccessControlConditions().then(humanizedAccessControlConditions => {
      setHumanizedAccessControlArray(() => humanizedAccessControlConditions);
    });
  }, [accessControlConditions])

  const handleAddAccessControl = async () => {
    setOpenShareModal(true);
    setOpenProvisionAccessDialog(false);
  };

  const handleGetShareLink = async () => {
    setOpenProvisionAccessDialog(false);
    setOpenShareModal(false);
    await handleSubmit();
  };

  const handleOpenProvisionAccessDialog = async () => {
    await loadMeetings(storedAuthSig);
    setOpenProvisionAccessDialog(true);
  };

  const handleCancelProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(false);
    setAccessControlConditions([]);
    setSelectedMeeting(null);
  };

  const handleOpenSnackBar = (message, severity) => {
    setSnackbarInfo({
      message: message,
      severity: severity
    })
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

      const serviceInfo = await getServiceInfo(storedAuthSig);
      // if previous connection exists, retrieve it from DB
      if (serviceInfo?.data[0]) {
        setCurrentServiceInfo(serviceInfo.data[0]);
        // await loadMeetings(storedAuthSig);
        await setUserProfile(serviceInfo.data[0])
        await getAllShares(storedAuthSig)
      } else {
        // if no connection is saved, connect to zoom
        await connectToZoom(storedAuthSig);
      }
    })
  }

  const setUserProfile = async (currentUserObject) => {
    const userBasicProfile = currentUserObject;

    const userProfile = {
      email: userBasicProfile.email,
      displayName: userBasicProfile.email,
      givenName: userBasicProfile.email,
      avatar: 'Z',
    };
    setCurrentUser(userProfile);
  }

  const connectToZoom = async (authSig) => {
    const resp = await axios.post(`${API_HOST}/api/oauth/zoom/serviceLogin`, {
      authSig,
    });
    if (resp.data.redirectTo) {
      window.location = resp.data.redirectTo;
    }
  }

  const loadMeetings = async (authSig) => {
    console.log('start of meetings and webinars')
    const resp = await getMeetingsAndWebinars({authSig});

    // const flatMeetings = resp.meetings.map((m) => m.meetings).flat();
    // const flatWebinars = resp.webinars.map((m) => m.webinars).flat();
    setMeetings(resp.meetingsAndWebinars);
  };

  const getAllShares = async (authSig) => {
    const allSharesHolder = await asyncHelpers.getAllShares(authSig);

    const humanizeAccPromiseArray = allSharesHolder.data.map(s => {
      const shareAcConditions = JSON.parse(s.accessControlConditions);
      return LitJsSdk.humanizeAccessControlConditions({
        accessControlConditions: shareAcConditions,
        myWalletAddress: storedAuthSig.address,
      })
    });

    Promise.all(humanizeAccPromiseArray).then(humanizedAcc => {
      let combinedAllShares = [];
      for (let i = 0; i < allSharesHolder.data.length; i++) {
        let singleShare = allSharesHolder.data[i];
        singleShare['humanizedAccessControlConditions'] = humanizedAcc[i];
        combinedAllShares.push(singleShare);
      }
      setAllShares(allSharesHolder.data.reverse());
    });
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

  const signOut = async () => {
    console.log('currentServiceInfo', currentServiceInfo)
    // logout(currentServiceInfo.email).then((res) => {
      setAccessControlConditions([]);
      setCurrentUser({});
      setCurrentServiceInfo(null);
      // TODO: figure out how to sign out of zoom
      window.location = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}`;
    // });
  };

  const handleSubmit = async () => {
    await performWithAuthSig(async (authSig) => {
      console.log("onAccessControlConditionsSelected", accessControlConditions);
      const chain = accessControlConditions[0].chain;

      const resp = await createMeetingShare({
        authSig,
        meeting: selectedMeeting,
        accessControlConditions,
      });

      // reload meeting with share so that when the user clicks "copy link"
      // in the access control modal, it actually works
      // const meetingsHolder = await loadMeetings(storedAuthSig);
      // console.log("meetings after sharing", meetingsHolder);
      const meeting = meetings.find((m) => m.id === selectedMeeting.id);
      setSelectedMeeting(meeting);
      const share = meeting.shares[0] ?? resp.data[0];

      console.log('SELECTED MEETING', share)

      const resourceId = getResourceIdForMeeting({
        meeting: { id: share.id },
        share,
      });

      const parsedAccessControlConditions = JSON.parse(share.accessControlConditions);

      await window.litNodeClient.saveSigningCondition({
        accessControlConditions: parsedAccessControlConditions,
        chain: parsedAccessControlConditions[0].chain,
        authSig,
        resourceId,
      });
      setSelectedMeeting(null);
      setAccessControlConditions([]);
      await getLinkFromShare(share);
      await getAllShares(storedAuthSig);
    });
  };

  const handleDeleteShare = async (shareInfo) => {
    try {
      await asyncHelpers.deleteShare(shareInfo.id);
      await getAllShares(storedAuthSig);
      handleOpenSnackBar(`${shareInfo.name} has been deleted.`, 'success');
    } catch (err) {
      console.log(`'Error deleting share', ${err}`)
      handleOpenSnackBar(`Error deleting share: ${err}`, 'error');
    }
  };

  const getLinkFromShare = async (share) => {
    console.log('SHARE!', share)
    const link = getSharingLink(share);
    setSnackbarInfo({
      message: `Link has been copied to clipboard.`,
      severity: 'info'
    })
    setOpenSnackbar(true);
    await navigator.clipboard.writeText(link)
  };

  return (
    <div>
      {(!storedAuthSig['sig'] || !currentServiceInfo) ? (
        <div className={'service-loader'}>
          <CircularProgress/>
          <h3>Waiting for Zoom - Ensure Pop-ups are enabled</h3>
        </div>
      ) : (
        <section className={"service-grid-container"}>
          <div className={'service-grid-header'}>
            <ServiceHeader
              serviceName={"Zoom App"}
              oauthServiceProvider={"Zoom"}
              currentUser={currentUser}
              serviceImageUrl={'/zoom.png'}
              signOut={signOut}
            />
          </div>
          <div className={'service-grid-links'}>
            <h3>Zoom Meetings and Webinars</h3>
            <ZoomMeetings
              className={"service-links"}
              serviceName={"Drive"}
              handleOpenProvisionAccessDialog={handleOpenProvisionAccessDialog}
              handleEditLinkAction={() => console.log('EDIT CLICKED')}
              handleCopyLinkAction={(share) => getLinkFromShare(share)}
              handleDownloadLinkAction={() => console.log('DOWNLOAD CLICKED')}
              handleDeleteLinkAction={(share) => handleDeleteShare(share)}
              listOfShares={allShares}/>
          </div>
          <ZoomProvisionAccessModal
            handleCancelProvisionAccessDialog={handleCancelProvisionAccessDialog}
            accessControlConditions={accessControlConditions}
            removeIthAccessControlCondition={removeIthAccessControlCondition}
            setAccessControlConditions={setAccessControlConditions}
            humanizedAccessControlArray={humanizedAccessControlArray}
            handleAddAccessControl={handleAddAccessControl}
            handleGetShareLink={handleGetShareLink}
            authSig={storedAuthSig}
            selectedMeeting={selectedMeeting}
            setSelectedMeeting={setSelectedMeeting}
            meetings={meetings}
            openProvisionAccessDialog={openProvisionAccessDialog}
            setOpenProvisionAccessDialog={setOpenProvisionAccessDialog}
          />

          {openShareModal && (
            <ShareModal
              onClose={() => setOpenShareModal(false)}
              sharingItems={[selectedMeeting]}
              onAccessControlConditionsSelected={async (restriction) => {
                await addToAccessControlConditions(restriction);
                setOpenShareModal(false);
                setOpenProvisionAccessDialog(true);
              }}
              getSharingLink={() => getSharingLink(selectedMeeting)}
              onlyAllowCopySharingLink={false}
              copyLinkText="Only authorized users will be able to enter this Zoom meeting"
              showStep="ableToAccess"
            />
          )}
          <LitProtocolConnection
            className={'lit-protocol-connection'}
            connection={!!storedAuthSig['sig']}/>
        </section>
      )}
      <Snackbar
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
      </Snackbar>
    </div>
  )
}
