import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import ZoomMeetings from "./ZoomGrantingComponents/ZoomMeetings";
import { useAppContext } from "../../context";
import { Alert, Avatar, Button, Card, CardContent, CircularProgress, Snackbar } from "@mui/material";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader";
import React, { useEffect, useState } from "react";
import { createMeetingShare, getAllShares, getMeetingsAndWebinars, getServiceInfo } from "./zoomAsyncHelpers";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ZoomProvisionAccessModal from "./zoomProvisionAccessModal/ZoomProvisionAccessModal";
import { ShareModal } from "lit-access-control-conditions-modal";
import { getResourceIdForMeeting, getSharingLink } from "./utils";
import * as asyncHelpers from "../zoom/zoomAsyncHelpers";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;

export default function ZoomGranting() {
  const { performWithAuthSig } = useAppContext();

  const [userSignedIn, setUserSignedIn] = useState(false);

  const [currentUser, setCurrentUser] = useState({})
  const [allShares, setAllShares] = useState([]);
  const [currentServiceInfo, setCurrentServiceInfo] = useState(null);
  const [storedAuthSig, setStoredAuthSig] = useState({});
  const [humanizedAccessControlArray, setHumanizedAccessControlArray] = useState([]);
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [token, setToken] = useState("");
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

  const handleOpenProvisionAccessDialog = () => {
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

  const loadAuth = async() => {
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
        console.log('SERVICE INFO', serviceInfo.data[0])
        await setUserProfile(serviceInfo.data[0])
        console.log('ZOOM SERVICE', serviceInfo.data[0])
        await loadMeetings(storedAuthSig);
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

  const connectToZoom = async(authSig) => {
    const resp = await axios.post(`${API_HOST}/api/oauth/zoom/serviceLogin`, {
      authSig,
    });
    if (resp.data.redirectTo) {
      window.location = resp.data.redirectTo;
    }
  }

  const loadMeetings = async (authSig) => {
    const resp = await getMeetingsAndWebinars({ authSig });
    // const flatMeetings = resp.meetings.map((m) => m.meetings).flat();
    // const flatWebinars = resp.webinars.map((m) => m.webinars).flat();
    setMeetings(resp.meetingsAndWebinars);
  };

  const getAllShares = async (authSig) => {
    const allSharesHolder = await asyncHelpers.getAllShares(authSig);
    setAllShares(allSharesHolder.data.reverse());
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
    await setCurrentServiceInfo(() => null);
    setAccessControlConditions([]);
    setCurrentUser({});
    // TODO: figure out how to sign out of zoom
    window.location = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}`;
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
      console.log('CREATE SHARE RESP', resp);
      await getLinkFromShare(resp.data[0]);

      // reload meeting with share so that when the user clicks "copy link"
      // in the access control modal, it actually works
      // const meetingsHolder = await loadMeetings(storedAuthSig);
      // console.log("meetings after sharing", meetingsHolder);
      const meeting = meetings.find((m) => m.id === selectedMeeting.id);
      setSelectedMeeting(meeting);
      const share = meeting.shares[0];
      console.log('SHARESHARE', meeting)

      const resourceId = getResourceIdForMeeting({
        meeting: selectedMeeting,
        share,
      });
      await window.litNodeClient.saveSigningCondition({
        accessControlConditions,
        chain,
        authSig,
        resourceId,
      });
      setSelectedMeeting( null);
      setAccessControlConditions( []);
      // getLinkFromShare()
      await getAllShares(storedAuthSig);
    });
  };

  const handleDeleteShare = async (shareInfo) => {
    try {
      await asyncHelpers.deleteShare(shareInfo.id);
      await getAllShares(storedAuthSig);
      handleOpenSnackBar(`${shareInfo.name} has been deleted.`, 'success');
    } catch(err) {
      console.log(`'Error deleting share', ${err}`)
      handleOpenSnackBar(`Error deleting share: ${err}`, 'error');
    }
  };

  const getLinkFromShare = async (share) => {
    const link = getSharingLink(share);
    setSnackbarInfo({
      message: `Link has been copied to clipboard.`,
      severity: 'info'
    })
    setOpenSnackbar(true);
    await navigator.clipboard.writeText(link)
  };

  // if (!storedAuthSig['sig'] || !currentServiceInfo) {
  //   return (
  //   <section className={'service-grid-container'}>
  //     <Card className={'service-grid-login'}>
  //       <CardContent>
  //         {/*<CircularProgress/>*/}
  //         <Button onClick={() => loadAuth()}>Connect your Zoom account</Button>
  //         {/*<h3>Working...</h3>*/}
  //       </CardContent>
  //       {/*<CardContent className={'login-container-top'}>*/}
  //       {/*    <span className={'login-service'}>*/}
  //       {/*      <Avatar sx={{width: 60, height: 60}}>Z</Avatar>*/}
  //       {/*      <div>*/}
  //       {/*        <h2 className={'service-title'}>Zoom</h2>*/}
  //       {/*        <p className={'service-category'}>Productivity</p>*/}
  //       {/*      </div>*/}
  //       {/*    </span>*/}
  //       {/*  {!storedAuthSig['sig'] ? (*/}
  //       {/*    <p>*/}
  //       {/*      Login with your wallet to proceed.*/}
  //       {/*    </p>*/}
  //       {/*  ) : (*/}
  //       {/*    <Button className={'service-launch-button'} variant={'contained'} onClick={() => connect("zoom")}>*/}
  //       {/*      Launch*/}
  //       {/*    </Button>*/}
  //       {/*  )}*/}
  //       {/*</CardContent>*/}
  //       {/*<CardContent class={'service-description'}>*/}
  //       {/*  <p>Create permissions based on wallet contents for your already-existing Zoom meetings. Our flexible permissions builders allows you to allow access based on token or NFT ownership as well as other wallet attributes, like membership in a DAO.</p>*/}
  //       {/*  <p>Once files are permissioned on the Lit Zoom App, you can edit wallet parameters, view/edit access, and delete it from the app which removes that access.</p>*/}
  //       {/*  <p>Wallets that meet the conditions will enter their email address for access.</p>*/}
  //       {/*</CardContent>*/}
  //     </Card>
  //     {/*<Snackbar*/}
  //     {/*  anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}}*/}
  //     {/*  open={openSnackbar}*/}
  //     {/*  autoHideDuration={4000}*/}
  //     {/*  onClose={handleCloseSnackbar}*/}
  //     {/*>*/}
  //     {/*  <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>*/}
  //     {/*</Snackbar>*/}
  //   </section>
  //   )
  // }

  return (
    <div>
      {(!storedAuthSig['sig'] || !currentServiceInfo) ? (
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
              handleCopyLinkAction={(linkUuid) => getLinkFromShare(linkUuid)}
              handleDownloadLinkAction={() => console.log('DOWNLOAD CLICKED')}
              handleDeleteLinkAction={(linkUuid) => handleDeleteShare(linkUuid)}
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
            accessToken={token}
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
        </section>
      )}
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}}
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
      </Snackbar>
    </div>
  )
}
