import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  TextField
} from "@mui/material";


export default function ProvisionAccess(props) {

  const handleSetRole = (event) => {
    props.setRole(event.target.value);
  }

  return (
    <section>
      <Dialog maxWidth={'md'} fullWidth={true} open={props.openProvisionAccessDialog}>
        <DialogTitle className={'provision-access-header'}>
          Provision Access
        </DialogTitle>
        <DialogContent>
          <section className={'provision-access-container'}>
            <p>Google Drive Link</p>
            <TextField fullWidth focused onChange={(e) => props.setLink(e.target.value)}/>
            <p>Permission Level</p>
            <FormControl fullWidth>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={props.role}
                onChange={handleSetRole}
              >
                <MenuItem value={0}>Read</MenuItem>
                <MenuItem value={1}>Comment</MenuItem>
                <MenuItem value={2}>Write</MenuItem>
              </Select>
            </FormControl>
          </section>
        </DialogContent>
        <DialogActions>
          <Button variant={'outlined'}
                  onClick={() => {
                    props.setModalOpen(true)
                    props.handleCloseProvisionAccessDialog()
                  }}>Add Access Control Conditions</Button>
          <Button variant={'outlined'} onClick={() => props.handleCloseProvisionAccessDialog()}>Close</Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}
