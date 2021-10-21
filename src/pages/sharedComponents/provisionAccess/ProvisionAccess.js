import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle, FormControl,
  IconButton,
  Input,
  InputLabel, MenuItem, Select,
  TextField
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';


export default function ProvisionAccess(props) {

  let role = 0

  const handleSetRole = (event) => {
    role = event.target.value;
    props.setRole(event.target.value);
  }

  return (
    <Dialog maxWidth={'md'} fullWidth={true} open={props.openProvisionAccessDialog}>
      <DialogTitle className={'provision-access-header'}>
        Provision Access
      </DialogTitle>
      <DialogContent>
        <section className={'provision-access-container'}>
          <p>Google Drive Link</p>
          <FormControl fullWidth>
            <Input className={'provision-access-input'} onChange={(e) => props.setLink(e.target.value)}/>
          </FormControl>
          {/*<TextField variants='standard' style={{ padding: '1rem'}} className={'provision-access-input'} focused />*/}
          {/*<TextField variants='standard' style={{ padding: '1rem'}} className={'provision-access-input'} focused />*/}
          <p>Permission Level</p>
          {/*<Button onClick={() => handleSetRole}>YO</Button>*/}
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
        <Button variant={'outlined'} onClick={() => props.handleCloseProvisionAccessDialog()}>Close</Button>
      </DialogActions>
    </Dialog>
)
}
