import React, { useState } from "react";

import "./ZoomMeetings.css";
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import { DateTime } from "luxon";
import { DATETIME_MED } from "luxon/src/impl/formats";
import LinkIcon from "@mui/icons-material/Link";
import DeleteIcon from "@mui/icons-material/Delete";

export default function ZoomMeetings(props) {
  const [openDeleteWarningModal, setOpenDeleteWarningModal] = useState(false);
  const [deleteShareInfo, setDeleteShareInfo] = useState({});

  const handleOpenDeleteModal = (shareInfo) => {
    setDeleteShareInfo(shareInfo);
    setOpenDeleteWarningModal(true);
  };

  const handleConfirmDelete = () => {
    props.handleDeleteLinkAction(deleteShareInfo);
    setOpenDeleteWarningModal(false);
  };

  return (
    <section>
      <Card className={"links-card"}>
        <span className={"links-header"}>
          <h3>Your Zoom Meetings</h3>
          <Button
            variant="outlined"
            onClick={() => props.handleOpenProvisionAccessDialog()}
          >
            Provision Access
          </Button>
        </span>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }}>
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
              {props.listOfShares.length > 0 &&
                props.listOfShares.map((share, i) => (
                  <TableRow
                    key={i}
                    sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      {share.name}
                    </TableCell>
                    <TableCell align="left">
                      {share.humanizedAccessControlConditions}
                    </TableCell>
                    <TableCell align="left">
                      {DateTime.fromISO(share.startTime).toLocaleString(
                        DATETIME_MED
                      )}
                    </TableCell>
                    <TableCell align="left">
                      {DateTime.fromISO(share.createdAt).toLocaleString(
                        DATETIME_MED
                      )}
                    </TableCell>
                    <TableCell align="left">
                      <span className={"links-actions"}>
                        {/*<IconButton size={'small'} onClick={props.handleEditLinkAction}>*/}
                        {/*  <EditIcon/>*/}
                        {/*</IconButton>*/}
                        <Tooltip title={"Copy share link"}>
                          <IconButton
                            size={"small"}
                            onClick={() => props.handleCopyLinkAction(share)}
                          >
                            <LinkIcon />
                          </IconButton>
                        </Tooltip>
                        {/*<IconButton size={'small'} onClick={props.handleDownloadLinkAction}>*/}
                        {/*  <DownloadIcon/>*/}
                        {/*</IconButton>*/}
                        <Tooltip title={"Delete link"}>
                          <IconButton
                            size={"small"}
                            onClick={() => handleOpenDeleteModal(share)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <Dialog open={openDeleteWarningModal}>
        <DialogTitle>Warning</DialogTitle>
        <DialogContent>
          Are you sure you want to delete link titled{" "}
          <strong>{deleteShareInfo.name}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteWarningModal(false)}>
            Cancel
          </Button>
          <Button onClick={() => handleConfirmDelete(deleteShareInfo)}>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
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
