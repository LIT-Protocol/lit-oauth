import React from "react";
import './BackToApps.scss';

export default function BackToApps() {
  return (
    <a href={'https://dev.litgateway.com/apps'} className={'back-to-apps-container'}>
      <div style={{backgroundImage: `url('/appslogo.svg')`}} className={'back-to-apps-logo'}/>
      <h2>Lit Apps</h2>
    </a>
  )
}
