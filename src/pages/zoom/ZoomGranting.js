// import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";
import ZoomMeetings from "./ZoomGrantingComponents/ZoomMeetings";
import { useAppContext } from "../../context";
import { Button } from "@mui/material";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader";
import { useEffect, useState } from "react";
import { getServiceInfo } from "./zoomAsyncHelpers";

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
  const signOut = () => {
    setCurrentServiceInfo(() => null);
  };

  useEffect(() => {
    const getService = async() => {
      await getConnectedService();
    }
      getService();
  }, [])


  const getConnectedService = async () => {
    await performWithAuthSig(async (authSig) => {
      const serviceInfo = await getServiceInfo(authSig);
      if (serviceInfo?.data[0]) {
        setCurrentServiceInfo(() => serviceInfo.data[0]);
      }
      console.log('SERVICE INFO', serviceInfo.data[0])
    })
  }

  const connect = async (service) => {
    await performWithAuthSig(async (authSig) => {
      if (service === "zoom") {
        const resp = await axios.post(`${API_HOST}/api/oauth/zoom/login`, {
          authSig,
        });
        if (resp.data.redirectTo) {
          window.location = resp.data.redirectTo;
        }
      }
    });
  };

  if (!currentServiceInfo) {
    return (
      <Button onClick={() => connect("zoom")}>Connect your Zoom account</Button>
    )
  }

  return (
    <section className={"service-grid-container"}>
      <div className={'service-grid-header'}>
        <ServiceHeader
          serviceName={"Zoom App"}
          oauthServiceProvider={"Zoom"}
          currentUser={currentUser}
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
