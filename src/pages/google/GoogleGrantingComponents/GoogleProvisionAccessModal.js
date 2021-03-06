/*global google*/

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import "./GoogleProvisionAccessModal.scss";
import DeleteIcon from "@mui/icons-material/Delete";

export default function GoogleProvisionAccessModal(props) {
  let picker;
  let pickerLoaded = false;

  const loadPicker = () => {
    window.gapi.load("picker", {
      callback: async () => {
        pickerLoaded = true;
        await createPicker();
      }
    });
  };

  const createPicker = async () => {
    const accessToken = props.accessToken;
    console.log('createPicker check access token', accessToken)

    if (accessToken?.length && pickerLoaded) {
      const origin = window.location.protocol + "//" + window.location.host;
      const view = window.google.picker.ViewId.DOCS;

      picker = new window.google.picker.PickerBuilder()
        .setOrigin(origin)
        .addView(view)
        .setOAuthToken(accessToken)
        .setAppId(process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID)
        .setDeveloperKey(
          process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_WEB_API_KEY
        )
        .setCallback(pickerCallback)
        .build();
      props.setOpenProvisionAccessDialog(false);
      picker.setVisible(true);
    }
  };

  const pickerCallback = (data) => {
    if (data?.action === "loaded") {
      return;
    }
    props.setOpenProvisionAccessDialog(true);
    if (data?.action === "picked") {
      props.setFile(data.docs[0]);
    }
  };

  return (
    <section>
      <Dialog
        maxWidth={"md"}
        fullWidth={true}
        open={props.openProvisionAccessDialog}
      >
        <DialogTitle className={"provision-access-header"}>
          Provision Access
        </DialogTitle>
        <DialogContent style={{ paddingBottom: "0" }}>
          <section className={"provision-access-container"}>
            <p>Google Drive Link</p>
            <span>
              <TextField
                disabled
                value={props["file"] ? props.file["name"] : ""}
                autoFocus
                style={{ paddingLeft: "0 !important" }}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <Button
                      style={{ marginRight: "1rem", width: "10rem" }}
                      onClick={() => loadPicker()}
                    >
                      Choose File
                    </Button>
                  ),
                  endAdornment: (
                    <IconButton
                      style={{ marginLeft: "0.5rem" }}
                      onClick={() => {
                        props.setFile(null);
                        props.setAccessControlConditions([]);
                      }}
                    >
                      <DeleteIcon/>
                    </IconButton>
                  ),
                }}
              />
            </span>
            <p>Permission Level</p>
            <FormControl fullWidth>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={props.role}
                onChange={(event) => props.setRole(event.target.value)}
              >
                {Object.entries(props.roleMap).map(([key, value], i) => (
                  <MenuItem key={i} value={value}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </section>
        </DialogContent>
        <DialogContent style={{ paddingTop: "0" }}>
          <section className={"provision-access-current-controls"}>
            <h4>Current Access Control Conditions</h4>
            {!!props.humanizedAccessControlArray && (
              <List dense={true}>
                {props.humanizedAccessControlArray
                  .split("and")
                  .map((acc, i) => (
                    <ListItem
                      key={i}
                      className={"provision-access-control-item"}
                      secondaryAction={
                        <IconButton
                          onClick={() =>
                            props.removeIthAccessControlCondition(i)
                          }
                        >
                          <DeleteIcon/>
                        </IconButton>
                      }
                    >
                      <ListItemText primary={acc}/>
                    </ListItem>
                  ))}
              </List>
            )}
            {!props.accessControlConditions.length && (
              <span>No current access control conditions</span>
            )}
          </section>
        </DialogContent>
        <DialogActions>
          <Button
            variant={"outlined"}
            disabled={!props.file}
            onClick={() => {
              props.handleAddAccessControl();
            }}
          >
            Create Requirement
          </Button>
          <Button
            disabled={!props.accessControlConditions.length}
            variant={"contained"}
            onClick={() => props.handleGetShareLink()}
          >
            Get Share Link
          </Button>
          <Button
            variant={"outlined"}
            onClick={() => props.handleCancelProvisionAccessDialog()}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
