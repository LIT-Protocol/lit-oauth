import { Alert, Avatar, Button, Card, CardContent, CardMedia, Typography, CardActions, Snackbar } from "@mui/material";
import { useEffect, useState } from "react";
import LitJsSdk from "lit-js-sdk";
import { serviceLoginConfig } from "./serviceLoginConfig";
import { useAppContext } from "../../context";

export default function ServiceLogin() {
  const { performWithAuthSig } = useAppContext();

  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({});
  const [storedAuthSig, setStoredAuthSig] = useState({});

  const [currentSelectedService, setCurrentSelectedService] = useState(serviceLoginConfig[0]);
  const [currentUnselectedServices, setCurrentUnselectedServices] = useState(serviceLoginConfig.slice(1));

  useEffect(() => {
    if (!storedAuthSig['sig']) {
      loadAuth();
    }
  }, []);

  const loadAuth = async () => {
    try {
      await performWithAuthSig(async (authSig) => {
        console.log('AUTH', authSig)
        setStoredAuthSig(() => authSig);
      });
    } catch (err) {
      console.log("LIT AUTH FAILURE", err);
      handleOpenSnackBar('Lit authentication failed.', 'error');
    }
  };

  const handleOpenSnackBar = (message, severity) => {
    setSnackbarInfo({
      message: message,
      severity: severity
    })
    setOpenSnackbar(true);
  }

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpenSnackbar(false);
  };

  const authenticate = (service) => {
    if (!storedAuthSig) {
      handleOpenSnackBar('Login in with Lit Protocol before proceeding to service.', 'error');
      return;
    }

    console.log('LOGIN' ,service);
    window.location = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/${service}`
  }

  const changeService = (service) => {
    const serviceLoginConfigClone = [...serviceLoginConfig];
    const selectedServiceIndex = serviceLoginConfigClone.findIndex(s => s.serviceTag === service);
    const newSelectedService = serviceLoginConfigClone.splice(selectedServiceIndex, 1);
    setCurrentSelectedService(newSelectedService[0]);
    setCurrentUnselectedServices(serviceLoginConfigClone);
  }

  return (
    <section className={'service-grid-container'}>
      <Card className={'service-grid-login'}>
        <CardContent className={'login-container-top'}>
            <span className={'login-service'}>
              <div className={'service-image'} style={{backgroundImage: `url(${currentSelectedService.serviceImageUrl}`}}/>
              <div>
                <h2 className={'service-title'}>{currentSelectedService.serviceName}</h2>
                <p className={'service-category'}>{currentSelectedService.serviceClassification}</p>
              </div>
            </span>
          {!storedAuthSig['sig'] ? (
            <p>
              Login with your wallet to proceed.
            </p>
          ) : (
            <Button className={'service-launch-button'} variant={'contained'} onClick={() => authenticate(currentSelectedService.serviceTag)}>
              Launch
            </Button>
          )}
        </CardContent>
        <CardContent className={'service-description'}>
          <p>Create permissions based on wallet contents for your already-existing {currentSelectedService.serviceName} files. Our flexible permissions builders allows you to allow access based on token or NFT ownership as well as other wallet attributes, like membership in a DAO.</p>
          <p>Once files are permissioned on the Lit {currentSelectedService.serviceName} App, you can edit wallet parameters, view/edit access, and delete it from the app which removes that access.</p>
          <p>Wallets that meet the conditions will enter their email address for access.</p>
        </CardContent>
      </Card>
      <section className={'unselected-services-container'}>
        <h2 className={'unselected-services-title'}>More Apps</h2>
        <span className={'unselected-services'}>
          { !!currentUnselectedServices.length && (
            currentUnselectedServices.map((s, i) => (
              <Card key={i} className={'unselected-service-card'} sx={{ maxWidth: 345 }}>
                <CardMedia
                  component="img"
                  height="60"
                  image={'/desk.jpeg'}
                />
                <CardContent>
                  <span className={'unselected-service-title'}>
                    <div className={'service-image'}
                         style={{backgroundImage: `url(${s.serviceImageUrl}`}}/>
                    <h2 className={'left-margin-buffer'}>{s.serviceName}</h2>
                    {/*<Typography gutterBottom variant="h5" component="div">*/}
                    {/*  {s.serviceName}*/}
                    {/*</Typography>*/}
                  </span>
                  <Typography variant="body2" color="text.secondary">
                    Grant access to {s.serviceName} with blockchain requirements.
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button variant={'outlined'} onClick={() => changeService(s.serviceTag)}size="small">Select</Button>
                </CardActions>
              </Card>

            ))
          )}
        </span>
      </section>
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}}
        open={openSnackbar}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
      </Snackbar>
    </section>
  )
}
