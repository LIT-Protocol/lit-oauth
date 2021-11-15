import './LitProtocolConnection.scss';
import { useEffect, useState } from "react";

export default function LitProtocolConnection(props) {

  let [status, setStatus] = useState ('Not Connected to Lit Protocol')
  let [statusColor, setStatusColor] = useState ('red')

  useEffect(() => {
    if (!!props.connection) {
      setStatus('Connected to Lit Protocol');
      setStatusColor('green');
    } else {
      setStatus('Not connected to Lit Protocol');
      setStatusColor('red');
    }
  }, [props])

  return (
    <span className={'lit-protocol-connection-container'}>
      <div style={{backgroundColor: statusColor}} className={'lit-protocol-status'}/>
      <p className={'lit-protocol-connection-text'}>{status}</p>
    </span>
  )
}
