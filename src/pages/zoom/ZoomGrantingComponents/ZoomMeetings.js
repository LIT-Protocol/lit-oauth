import React, { useEffect, useState } from "react";

import { getMeetingsAndWebinars, createMeetingShare, getAllShares, deleteShare } from "../zoomAsyncHelpers";
import { useAppContext } from "../../../context";

import LitJsSdk from "lit-js-sdk";

import { ShareModal } from "lit-access-control-conditions-modal";

import "./ZoomMeetings.css";
import { getResourceIdForMeeting, getSharingLink } from "../utils";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Card,
  Button,
  Paper,
  TableHead,
  TableRow,
  TableCell,
  TableContainer,
  Table, TableBody, IconButton, Tooltip, Alert
} from "@mui/material";
import { DateTime } from "luxon";
import { DATETIME_MED } from "luxon/src/impl/formats";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import DeleteIcon from "@mui/icons-material/Delete";
import ZoomProvisionAccessModal from "../zoomProvisionAccessModal/ZoomProvisionAccessModal";

export default function ZoomMeetings(props) {
  const { performWithAuthSig } = useAppContext();
  const [meetings, setMeetings] = useState([]);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [openDeleteWarningModal, setOpenDeleteWarningModal] = useState(false);
  const [deleteShareInfo, setDeleteShareInfo] = useState({});
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const [allShares, setAllShares] = useState([]);
  const [token, setToken] = useState("");
  const [connectedServiceId, setConnectedServiceId] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [currentUser, setCurrentUser] = useState({});
  const [storedAuthSig, setStoredAuthSig] = useState({});
  const [humanizedAccessControlArray, setHumanizedAccessControlArray] = useState([]);

  const [openShareModal, setOpenShareModal] = useState(false);
  const [openProvisionAccessDialog, setOpenProvisionAccessDialog] =
    useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({});

  useEffect(() => {
    const go = async () => {
      const resp = await loadMeetings();
      await retrieveAllShares();
    };
    go();
  }, []);

  const handleAddAccessControl = async () => {
    setOpenShareModal(true);
    setOpenProvisionAccessDialog(false);
  };

  const handleGetShareLink = async () => {
    setOpenProvisionAccessDialog(false);
    // setOpenShareModal(false);
    await handleSubmit();
  };

  const handleOpenProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(true);
  };

  const handleCancelProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(false);
    setAccessControlConditions(() => []);
    setSelectedMeeting(() => null);
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

  const handleOpenDeleteModal = (shareInfo) => {
    setDeleteShareInfo(shareInfo);
    setOpenDeleteWarningModal(true);
  }

  const handleConfirmDelete = async (shareInfo) => {
    setOpenDeleteWarningModal(false);
    console.log('ZOOM SHARE', shareInfo)
    try {
      await deleteShare(shareInfo.id);
      await retrieveAllShares();
      setSnackbarInfo({
        message: `${shareInfo.name} has been deleted.`,
        severity: 'success'
      });
      setOpenSnackbar(true);
    } catch(err) {
      console.log(`'Error deleting share', ${err}`)
      setSnackbarInfo({
        message: `'Error deleting share', ${err}`,
        severity: 'error'
      });
      setOpenSnackbar(true);
    }
  };

  const getAuthSig = async () => {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  };

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

  const retrieveAllShares = async() => {
    const authSigHolder = await getAuthSig();
    console.log('AUTH SIG', authSigHolder)
    const allShares = await getAllShares(authSigHolder);
    console.log('ALL SHARES', allShares.data)
    setAllShares(allShares.data.reverse());
  }

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

  const loadMeetings = async () => {
    return await performWithAuthSig(async (authSig) => {
      const resp = await getMeetingsAndWebinars({ authSig });
      // const flatMeetings = resp.meetings.map((m) => m.meetings).flat();
      // const flatWebinars = resp.webinars.map((m) => m.webinars).flat();
      setMeetings(resp.meetingsAndWebinars);
      return resp.meetingsAndWebinars;
    });
  };

  // const handleGrantAccess = async (meeting) => {
  //   await LitJsSdk.checkAndSignAuthMessage({
  //     chain: "ethereum",
  //   });
  //   setSelectedMeeting(meeting);
  //   setOpenShareModal(true);
  // };
  //
  // const closeShareModal = () => {
  //   setOpenShareModal(false);
  // };

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

      // reload meeting with share so that when the user clicks "copy link"
      // in the access control modal, it actually works
      const meetings = await loadMeetings();
      console.log("meetings after sharing", meetings);
      const meeting = meetings.find((m) => m.id === selectedMeeting.id);
      setSelectedMeeting(meeting);
      const share = meeting.shares[0];

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
      setSelectedMeeting(() => null);
      setAccessControlConditions(() => []);
      await retrieveAllShares();
    });
  };

  const handleCopyShareLink = async (share) => {
    const link = getSharingLink(share);
    setSnackbarInfo({
      message: `Link has been copied to clipboard.`,
      severity: 'info'
    })
    setOpenSnackbar(true);
    await navigator.clipboard.writeText(link)
  };

  const getAccessControlConditions = (accessControl) => {
    return JSON.parse(accessControl)[0].chain;
  }

  return (
    <section>
      <Card className={'links-card'}>
        <span className={'links-header'}>
          <h3>Your Zoom Meetings</h3>
          <Button variant='outlined' onClick={() => handleOpenProvisionAccessDialog()}>Provision Access</Button>
        </span>
        <TableContainer component={Paper}>
          <Table sx={{minWidth: 650}}>
            <TableHead>
              <TableRow>
                <TableCell align="left">Meeting Title</TableCell>
                <TableCell align="left">Requirements</TableCell>
                <TableCell align="left">Meeting Date</TableCell>
                <TableCell align="left">Date Created</TableCell>
                <TableCell align="left">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allShares.length > 0 && allShares.map((share, i) => (
                <TableRow
                  key={i}
                  sx={{'&:last-child td, &:last-child th': {border: 0}}}
                >
                  <TableCell component="th" scope="row">
                    {share.name}
                  </TableCell>
                  <TableCell align="left">{getAccessControlConditions(share.accessControlConditions)}</TableCell>
                  <TableCell align="left">{DateTime.fromISO(share.start_time).toLocaleString(DATETIME_MED)}</TableCell>
                  <TableCell align="left">{DateTime.fromISO(share.createdAt).toLocaleString(DATETIME_MED)}</TableCell>
                  <TableCell align="left">
                    <span className={'links-actions'}>
                      {/*<IconButton size={'small'} onClick={props.handleEditLinkAction}>*/}
                      {/*  <EditIcon/>*/}
                      {/*</IconButton>*/}
                      <Tooltip title={'Copy share link'}>
                        <IconButton size={'small'} onClick={() => handleCopyShareLink(share)}>
                          <LinkIcon/>
                        </IconButton>
                      </Tooltip>
                      {/*<IconButton size={'small'} onClick={props.handleDownloadLinkAction}>*/}
                      {/*  <DownloadIcon/>*/}
                      {/*</IconButton>*/}
                      <Tooltip title={'Delete link'}>
                        <IconButton size={'small'} onClick={() => handleOpenDeleteModal(share)}>
                          <DeleteIcon/>
                        </IconButton>
                      </Tooltip>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {/*<div className="ZoomMeetings">*/}
        {/*  {meetings ? (*/}
        {/*    meetings.map((m) => (*/}
        {/*      <div className="Meeting" key={m.id}>*/}
        {/*        <div className="MeetingColumn">{m.topic}</div>*/}
        {/*        <div className="MeetingColumn">*/}
        {/*          {new Date(m.start_time).toLocaleString()}*/}
        {/*        </div>*/}
        {/*        <div className="MeetingColumn">*/}
        {/*          <Button*/}
        {/*            view="secondary"*/}
        {/*            label="Grant Access"*/}
        {/*            onClick={() => handleGrantAccess(m)}*/}
        {/*          />*/}
        {/*          {m.shares && m.shares.length > 0 ? (*/}
        {/*            <Button*/}
        {/*              label="Copy share link"*/}
        {/*              onClick={() => handleCopyShareLink(m)}*/}
        {/*            />*/}
        {/*          ) : null}*/}
        {/*        </div>*/}
        {/*      </div>*/}
        {/*    ))*/}
        {/*  ) : (*/}
        {/*    <ProgressSpin />*/}
        {/*  )}*/}
        {/*</div>*/}
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

          {openShareModal ? (
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
          ) : null}
      </Card>
      <Dialog
        open={openDeleteWarningModal}
      >
        <DialogTitle>Warning</DialogTitle>
        <DialogContent>
          Are you sure you want to delete link titled <strong>{deleteShareInfo.name}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteWarningModal(false)}>
            Cancel
          </Button>
          <Button onClick={() => handleConfirmDelete(deleteShareInfo)}>Yes</Button>
        </DialogActions>
      </Dialog>
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
