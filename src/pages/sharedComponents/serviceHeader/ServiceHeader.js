import { useState, useRef } from "react";
import { presetGpnDefault, Theme } from "@consta/uikit/Theme";
import { Card } from "@consta/uikit/Card";
import { Text } from "@consta/uikit/Text";
import { ContextMenu } from "@consta/uikit/ContextMenu";
import { Button } from "@consta/uikit/Button";
import { IconArrowDown } from '@consta/uikit/IconArrowDown';
import { IconPhoto } from '@consta/uikit/IconPhoto';
import { IconSmile } from '@consta/uikit/IconSmile';

import './ServiceHeader.scss';

export default function ServiceHeader(props) {
  const serviceName = props.serviceName;
  const oauthServiceProvider = props.oauthServiceProvider;
  const currentUser = props.currentUser;
  const [userOptionsAreOpen, setUserOptionsAreOpen] = useState(false);
  const userOptionsRef = useRef(null);

  const accounts = {};
  const dropdownOptions = [
    {
      label: 'Add Account',
      action: 'addAccount',
      id: 1
    },
    {
      label: 'Logout',
      action: 'signOut',
      id: 2
    }
  ]

  const handleDropdownActions = (event) => {
    if (event.target.innerText === 'Logout') {
      props.signOut();
    }
  }

  return (
    <Theme preset={presetGpnDefault}>
      <Card className={"header-card"} verticalSpace={"l"} horizontalSpace={"4xl"}>
        <span className={'header-left'}>
          <IconPhoto className={'header-service-provider'}/>
          <Text spacing={'m'}>{ serviceName }</Text>
        </span>
        <span className={'header-right'}>
          <Text iconLeft={IconPhoto} className={'header-user-status-text'} size={'xs'} spacing={'s'}>Logged in with { oauthServiceProvider }</Text>
          <span>
            <Button className={'header-user-options'}
                    label={currentUser}
                    iconRight={IconArrowDown}
                    iconLeft={IconSmile}
                    ref={userOptionsRef}
                    onClick={() => setUserOptionsAreOpen(!userOptionsAreOpen)}/>
            { userOptionsAreOpen && (
              <ContextMenu items={dropdownOptions}
                           size={'s'}
                           anchorRef={userOptionsRef}
                           getLabel={(item) => item.label}
                           direction="downStartRight"
                           getOnClick={() => handleDropdownActions}
                           onClickOutside={() => setUserOptionsAreOpen(false)}
              />
            )}
          </span>
        </span>
      </Card>
    </Theme>
  )
}
