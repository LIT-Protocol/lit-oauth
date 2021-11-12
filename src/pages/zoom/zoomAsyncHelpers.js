import axios from "axios";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const getMeetingsAndWebinars = async ({ authSig }) => {
  const resp = await axios.post(`${API_HOST}/api/zoom/meetingsAndWebinars`, {
    authSig,
  });

  return resp.data;
};

export const logout = async (user) => {
  const resp = await axios.post(`${API_HOST}/api/zoom/serviceLogout`, {
    user,
  });

  return resp.data;
};

export const getShares = async ({ authSig, meetingId }) => {
  const resp = await axios.post(`${API_HOST}/api/zoom/shares`, {
    authSig,
    meetingId,
  });

  return resp.data;
};

export const getMeetingUrl = async ({ assetType, jwt, assetIdOnService, shareId }) => {
  const resp = await axios.post(`${API_HOST}/api/zoom/getMeetingUrl`, {
    jwt,
    assetType,
    assetIdOnService,
    shareId,
  });

  return resp.data;
};

export const getServiceInfo = async(authSig) => {
  return await axios.post(`${API_HOST}/api/zoom/getServiceInfo`, { authSig });
}

export const createMeetingShare = async ({
  authSig,
  meeting,
  accessControlConditions,
}) => {
  const data = await axios.post(`${API_HOST}/api/zoom/shareMeeting`, {
    authSig,
    meeting,
    accessControlConditions,
  });

  return data;
};

export const getAllShares = async (authSig) => {
  return await axios.post(`${API_HOST}/api/zoom/getAllShares`, {
    authSig,
  });
}

export const deleteShare = async (shareUuid) => {
  return await axios.post(`${API_HOST}/api/zoom/deleteShare`, {uuid: shareUuid});
}
