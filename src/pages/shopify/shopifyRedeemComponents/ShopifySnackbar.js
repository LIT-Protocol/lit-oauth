import { Snackbar, Button, IconButton, Alert } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import React from "react";

const ShopifySnackbar = ({snackbarInfo, openSnackbar, setOpenSnackbar}) => {
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpenSnackbar(false);
  };

  const action = (
    <React.Fragment>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleCloseSnackbar}
      >
        <CloseIcon fontSize="small"/>
      </IconButton>
    </React.Fragment>
  );

  return (
    <Snackbar open={openSnackbar}
              autoHideDuration={5000}
              onClose={handleCloseSnackbar}
              anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}>
      <Alert onClose={handleCloseSnackbar} severity={snackbarInfo.severity} sx={{width: '100%'}}>
        {snackbarInfo.message}
      </Alert>
    </Snackbar>
  )
}

export default ShopifySnackbar;