import { useState, useRef, useEffect } from "react";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Avatar, Button, Card, Menu, MenuItem } from "@mui/material";
import './ServiceHeader.scss';

export default function ServiceHeader(props) {
  const serviceName = props.serviceName;
  const oauthServiceProvider = props.oauthServiceProvider;
  let currentUser = props.currentUser;
  const [userOptionsAreOpen, setUserOptionsAreOpen] = useState(false);
  const open = Boolean(userOptionsAreOpen);

  useEffect(() => {
    currentUser = props.currentUser;
  }, [props.currentUser])

  const handleUserMenuClick = (event) => {
    setUserOptionsAreOpen(event.currentTarget);
  };

  const handleClose = () => {
    setUserOptionsAreOpen(null);
  };

  const handleMenuItemClick = (event) => {
    setUserOptionsAreOpen(null);
    if (event.target.innerText === 'Logout') {
      props.signOut();
    }
  }

  return (
    <Card className={'header-card'}>
      <span className={'header-left'}>
        {/*<img src={require('props.serviceImage')}/>*/}
        <Avatar className={'right-buffer'}>G</Avatar>
        <h2>{serviceName}</h2>
      </span>
      <span className={'header-right'}>
        <p className={'service-text right-buffer'}>
          Logged in with {oauthServiceProvider}
        </p>
        <Button variant="contained"
          onClick={handleUserMenuClick}
          className={'header-user-menu'}
        >
          <Avatar className={'right-buffer'}>{currentUser.avatar}</Avatar>
          <div className={'user-info right-buffer'}>
            <span className={'user-name'}>
              {currentUser.displayName}
            </span>
            <span className={'user-email'}>
              {currentUser.email}
            </span>
          </div>
          <KeyboardArrowDownIcon />
        </Button>
        <Menu
          className={'header-user-menu-options'}
          anchorEl={userOptionsAreOpen}
          open={open}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {/*<MenuItem key={0} onClick={handleMenuItemClick}>Add Account</MenuItem>*/}
          {/*{accounts.map((account, i) => {*/}
          {/*  <MenuItem key={i + 2} onClick={handleMenuItemClick}>{account.accountName}</MenuItem>*/}
          {/*})}*/}
          <MenuItem key={1} onClick={handleMenuItemClick}>Logout</MenuItem>
        </Menu>
      </span>
    </Card>
  )
}
