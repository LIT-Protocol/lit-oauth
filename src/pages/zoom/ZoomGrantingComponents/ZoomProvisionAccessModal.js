import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody, Tooltip,
} from "@mui/material";
import './ZoomProvisionAccessModal.scss';
import DeleteIcon from '@mui/icons-material/Delete';
import { DateTime } from "luxon";
import { DATETIME_MED } from "luxon/src/impl/formats";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import React from "react";

export default function ZoomProvisionAccessModal(props) {

  return (
    <section>
      <Dialog maxWidth={'md'} fullWidth={true} open={props.openProvisionAccessDialog}>
        <DialogTitle className={'provision-access-header'}>
          Provision Access
        </DialogTitle>
        {/*<DialogContent style={{ paddingBottom: '0'}}>*/}
        {/*  <section className={'provision-access-current-controls'}>*/}
        {/*    <h4>Current Access Control Conditions</h4>*/}
        {/*    {props.humanizedAccessControlArray.length > 0 &&*/}
        {/*      <List dense={true}>*/}
        {/*        {props.humanizedAccessControlArray.map((accessControl, i) =>*/}
        {/*          <ListItem className={'provision-access-control-item'}*/}
        {/*            secondaryAction={*/}
        {/*              <IconButton onClick={() => props.removeIthAccessControlCondition(i)}>*/}
        {/*                <DeleteIcon />*/}
        {/*              </IconButton>*/}
        {/*            }>*/}
        {/*            <ListItemText*/}
        {/*              primary={accessControl}*/}
        {/*            />*/}
        {/*          </ListItem>*/}
        {/*        )}*/}
        {/*      </List>*/}
        {/*    }*/}
        {/*    {!props.humanizedAccessControlArray.length &&*/}
        {/*      <span>No current access control conditions</span>*/}
        {/*    }*/}
        {/*  </section>*/}
        {/*</DialogContent>*/}
        <DialogContent>
          {!props.selectedMeeting || !props.selectedMeeting['join_url'] ? (
            <TableContainer component={Paper}>
              <Table sx={{minWidth: 650}}>
                <TableHead>
                  <TableRow>
                    <TableCell align="left">Meeting Title</TableCell>
                    <TableCell align="left">Meeting Time</TableCell>
                    <TableCell align="left">Date Created</TableCell>
                    <TableCell align="left">Select Meeting</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {props.meetings.length > 0 && props.meetings.map((meeting, i) => (
                    <TableRow
                      key={i}
                      sx={{'&:last-child td, &:last-child th': {border: 0}}}
                    >
                      <TableCell component="th" scope="row">
                        {meeting.topic}
                      </TableCell>
                      <TableCell align="left">{DateTime.fromISO(meeting.start_time).toLocaleString(DATETIME_MED)}</TableCell>
                      <TableCell align="left">{DateTime.fromISO(meeting.created_at).toLocaleString(DATETIME_MED)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={'Select this meeting'}>
                          <IconButton size={'small'} onClick={() => {
                            console.log('MEETING', meeting)
                            props.setSelectedMeeting(() => meeting)
                          }}>
                            <ArrowForwardIcon/>
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <section className={'provision-access-current-controls'}>
              <span>
                <Tooltip title={'Back to select meeting'}>
                  <IconButton size={'small'} onClick={() => {
                    props.setAccessControlConditions(() => [])
                    props.setSelectedMeeting(() => null)
                  }}>
                    <ArrowBackIcon/>
                  </IconButton>
                </Tooltip>
                <p>Meeting Name: <strong>{ props.selectedMeeting.topic }</strong></p>
                <p>Meeting Time: <strong>{DateTime.fromISO(props.selectedMeeting.start_time).toLocaleString(DATETIME_MED)}</strong></p>
                <p>Date Created: <strong>{DateTime.fromISO(props.selectedMeeting.created_at).toLocaleString(DATETIME_MED)}</strong></p>
              </span>
              <h4>Current Access Control Conditions</h4>
              {props.humanizedAccessControlArray.length > 0 &&
              <List dense={true}>
                {props.humanizedAccessControlArray.map((accessControl, i) =>
                  <ListItem className={'provision-access-control-item'}
                            key={i}
                            secondaryAction={
                              <IconButton onClick={() => props.removeIthAccessControlCondition(i)}>
                                <DeleteIcon />
                              </IconButton>
                            }>
                    <ListItemText
                      primary={accessControl}
                    />
                  </ListItem>
                )}
              </List>
              }
              {!props.humanizedAccessControlArray.length &&
              <span>No current access control conditions</span>
              }
            </section>
          )}
        </DialogContent>
        <DialogActions>
          {!!props.selectedMeeting && props.selectedMeeting['join_url'] && (
            <span>
              <Button variant={'outlined'}
                      disabled={!props.selectedMeeting}
                      onClick={() => {
                        props.handleAddAccessControl()
                      }}>Create Requirement</Button>
              <Button disabled={!props.accessControlConditions.length}
                      style={{marginLeft: '0.5rem'}}
                      variant={'outlined'}
                      onClick={() => props.handleGetShareLink()}>Get Share Link</Button>
            </span>
          )}
          <Button variant={'outlined'}
                  style={{marginLeft: '0.5rem'}}
                  onClick={() => props.handleCancelProvisionAccessDialog()}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}
