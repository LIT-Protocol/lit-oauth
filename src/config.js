export const URL_MAP = {
  zoomGranting: {
    path: "/",
    componentName: "ZoomGranting",
    exact: true,
  },
  zoomAccess: {
    path: "/share/zoom/:meetingId",
    componentName: "ZoomAccess",
    exact: false,
  },
  google: {
    path: "/google",
    componentName: "GoogleContainer",
    exact: true,
  },
};

export const HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
