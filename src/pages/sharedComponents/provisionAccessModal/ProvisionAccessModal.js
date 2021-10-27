import {
  Button,
  FormControl,
  MenuItem,
  Select,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from "@mui/material";
import './ProvisionAccessModal.scss';

export default function ProvisionAccessModal(props) {

  return (
    <section>
      <Dialog maxWidth={'md'} fullWidth={true} open={props.openProvisionAccessDialog}>
        <DialogTitle className={'provision-access-header'}>
          Provision Access
        </DialogTitle>
        <DialogContent>
          <section className={'provision-access-current-controls'}>
            <h4>Current Access Control Conditions</h4>
            {props.accessControlConditions && ( props.accessControlConditions.map((accessControl, i) => (
              <span key={i} onClick={() => props.removeIthAccessControlCondition(i)}>{JSON.stringify(accessControl)}</span>
            )))}
            {!props.accessControlConditions.length && (
              <span>No current access control conditions</span>
            )}
          </section>
        </DialogContent>
        <DialogContent>
          <section className={'provision-access-container'}>
            <p>Google Drive Link</p>
            <TextField fullWidth autoFocus onChange={(e) => props.setLink(e.target.value)}/>
            <p>Permission Level</p>
            <FormControl fullWidth>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={props.role}
                onChange={(event) => props.setRole(event.target.value)}
              >{ Object.entries(props.roleMap).map(([key, value], i) => (
                <MenuItem key={i} value={value}>{key}</MenuItem>
              ))}
              </Select>
            </FormControl>
          </section>
        </DialogContent>
        <DialogActions>
          <Button variant={'outlined'}
                  disabled={!props.link.length}
                  onClick={() => {
                    props.handleAddAccessControl()
                  }}>Add Access Control Conditions</Button>
          <Button disabled={!props.accessControlConditions.length} variant={'outlined'} onClick={() => props.handleGetShareLink()}>Get Share Link</Button>
          <Button variant={'outlined'} onClick={() => props.handleCancelProvisionAccessDialog()}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}
