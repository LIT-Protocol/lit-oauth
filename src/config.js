export const URL_MAP = {
  google: {
    path: "/google",
    componentName: "GoogleGranting",
    exact: true,
  },
  googleLink: {
    path: "/google/l/:linkId",
    componentName: "GoogleLink",
    exact: true,
  },
  zoomGranting: {
    path: ["/", "/zoom"],
    componentName: "ZoomGranting",
    exact: true,
  },
  zoomAccess: {
    path: "/share/zoom/:meetingId",
    componentName: "ZoomAccess",
    exact: false,
  },
};

export const HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
