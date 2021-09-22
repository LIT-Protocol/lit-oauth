import ZoomAccess from "./pages/zoom/ZoomAccess.js";
import ZoomGranting from "./pages/zoom/ZoomGranting.js";

export const URL_MAP = {
  zoomGranting: {
    path: "/",
    component: ZoomGranting,
    exact: true,
  },
  zoomAccess: {
    path: "/share/zoom/:meetingId",
    component: ZoomAccess,
    exact: false,
  },
};

export const HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
