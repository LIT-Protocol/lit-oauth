// import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import ZoomMeetings from "./ZoomGrantingComponents/ZoomMeetings";
import { useAppContext } from "../../context";
import { Alert, Avatar, Button, Card, CardContent, CircularProgress, Snackbar } from "@mui/material";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader";
import { useEffect, useState } from "react";
import { getServiceInfo } from "./zoomAsyncHelpers";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

const mockInitialUser = {
  email: 'trotksy@stalinsucks.mx',
  displayName: 'leon',
  givenName: 'leon the trotsky',
  avatar: 'l'
}


export default function ZoomGranting() {
  const { performWithAuthSig } = useAppContext();

  const [currentUser, setCurrentUser] = useState(mockInitialUser)
  const [currentServiceInfo, setCurrentServiceInfo] = useState(null);
  const [storedAuthSig, setStoredAuthSig] = useState({});
  const signOut = async () => {
    await setCurrentServiceInfo(() => null);
    // TODO: figure out how to sign out of zoom
    window.location = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}`;
  };

  useEffect(() => {
    const getService = async() => {
      await getConnectedService();
    }
    getService();
  }, [])


  const getConnectedService = async () => {
    await performWithAuthSig(async (authSig) => {
      setStoredAuthSig(authSig);
      const serviceInfo = await getServiceInfo(authSig);
      if (serviceInfo?.data[0]) {
        setCurrentServiceInfo(() => serviceInfo.data[0]);
      };
      console.log('SERVICE INFO', serviceInfo.data[0])
    })
  }

  const connect = async (service) => {
    await performWithAuthSig(async (authSig) => {
      if (service === "zoom") {
        const resp = await axios.post(`${API_HOST}/api/oauth/zoom/serviceLogin`, {
          authSig,
        });
        if (resp.data.redirectTo) {
          window.location = resp.data.redirectTo;
        }
      }
    });
  };

  if (!storedAuthSig['sig'] || !currentServiceInfo) {
    return (
    <section className={'service-grid-container'}>
      <Card className={'service-grid-login'}>
        <CardContent>
          {/*<CircularProgress/>*/}
          <Button onClick={() => connect("zoom")}>Connect your Zoom account</Button>
          {/*<h3>Working...</h3>*/}
        </CardContent>
        {/*<CardContent className={'login-container-top'}>*/}
        {/*    <span className={'login-service'}>*/}
        {/*      <Avatar sx={{width: 60, height: 60}}>Z</Avatar>*/}
        {/*      <div>*/}
        {/*        <h2 className={'service-title'}>Zoom</h2>*/}
        {/*        <p className={'service-category'}>Productivity</p>*/}
        {/*      </div>*/}
        {/*    </span>*/}
        {/*  {!storedAuthSig['sig'] ? (*/}
        {/*    <p>*/}
        {/*      Login with your wallet to proceed.*/}
        {/*    </p>*/}
        {/*  ) : (*/}
        {/*    <Button className={'service-launch-button'} variant={'contained'} onClick={() => connect("zoom")}>*/}
        {/*      Launch*/}
        {/*    </Button>*/}
        {/*  )}*/}
        {/*</CardContent>*/}
        {/*<CardContent class={'service-description'}>*/}
        {/*  <p>Create permissions based on wallet contents for your already-existing Zoom meetings. Our flexible permissions builders allows you to allow access based on token or NFT ownership as well as other wallet attributes, like membership in a DAO.</p>*/}
        {/*  <p>Once files are permissioned on the Lit Zoom App, you can edit wallet parameters, view/edit access, and delete it from the app which removes that access.</p>*/}
        {/*  <p>Wallets that meet the conditions will enter their email address for access.</p>*/}
        {/*</CardContent>*/}
      </Card>
      {/*<Snackbar*/}
      {/*  anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}}*/}
      {/*  open={openSnackbar}*/}
      {/*  autoHideDuration={4000}*/}
      {/*  onClose={handleCloseSnackbar}*/}
      {/*>*/}
      {/*  <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>*/}
      {/*</Snackbar>*/}
    </section>
    )
  }

  return (
    <section className={"service-grid-container"}>
      <Button aria-label="delete" size="large" startIcon={<ArrowBackIcon/>} onClick={() => window.location = `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}`}>
        Back to all Apps
      </Button>
      <div className={'service-grid-header'}>
        <ServiceHeader
          serviceName={"Zoom App"}
          oauthServiceProvider={"Zoom"}
          currentUser={currentUser}
          serviceImageUrl={'/zoom.png'}
          signOut={signOut}
        />
      </div>
      <div className={'service-grid-links'}>
        <h3>Zoom Meetings and Webinars</h3>
        <ZoomMeetings />
      </div>
    </section>
  );
}
