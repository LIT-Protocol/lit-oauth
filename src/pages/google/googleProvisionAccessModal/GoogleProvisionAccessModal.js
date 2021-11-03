/*global google*/

import {
  Button,
  FormControl,
  MenuItem,
  Select,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import "./GoogleProvisionAccessModal.scss";
import DeleteIcon from "@mui/icons-material/Delete";

export default function GoogleProvisionAccessModal(props) {
  let picker;

  const createPicker = () => {
    props.setOpenProvisionAccessDialog(false);

    if (props.accessToken?.length) {
      const view = new google.picker.View(google.picker.ViewId.DOCS);
      picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(props.accessToken)
        .setAppId(process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID)
        .setDeveloperKey(
          process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_WEB_API_KEY
        )
        .setCallback(pickerCallback)
        .build();
      picker.setVisible(true);
    }
  };

  const pickerCallback = (data) => {
    if (data?.action === "loaded") {
      return;
    }
    console.log("DATA FROM PICKER", data);
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
                      onClick={() => createPicker()}
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
                      <DeleteIcon />
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
            {props.humanizedAccessControlArray.length > 0 && (
              <List dense={true}>
                <ListItem
                  className={"provision-access-control-item"}
                  secondaryAction={
                    <IconButton
                      onClick={() => props.removeAccessControlCondition}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={props.humanizedAccessControlArray.join(" and ")}
                  />
                </ListItem>
              </List>
            )}
            {!props.humanizedAccessControlArray.length && (
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
            Add Access Control Conditions
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
