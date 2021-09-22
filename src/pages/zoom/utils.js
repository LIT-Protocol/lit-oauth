import { URL_MAP, HOST } from "../../config.js";

export const getSharingLinkPath = (meeting) => {
  const path = URL_MAP.zoomAccess.path.replace(":meetingId", meeting.id);
  return path;
};

export const getSharingLink = (meeting) => {
  const path = getSharingLinkPath(meeting);
  return HOST + path;
};

export const getResourceIdForMeeting = ({ meeting, share }) => {
  const path = getSharingLinkPath(meeting);
  const resourceId = {
    baseUrl: HOST,
    path,
    orgId: "",
    role: "",
    extraData: JSON.stringify({
      shareId: share.id,
    }),
  };
  return resourceId;
};
