import axios from "axios";
import LitJsSdk from "lit-js-sdk";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const getMeetingsAndWebinars = async ({ authSig }) => {
  const resp = await axios.post(`${API_HOST}/api/zoom/meetingsAndWebinars`, {
    authSig,
  });

  return resp.data;
};

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

export const getShares = async ({ authSig, meetingId }) => {
  const resp = await axios.post(`${API_HOST}/api/zoom/shares`, {
    authSig,
    meetingId,
  });

  return resp.data;
};

export const getMeetingUrl = async ({ meetingId, jwt, shareId }) => {
  const resp = await axios.post(`${API_HOST}/api/zoom/getMeetingUrl`, {
    jwt,
    meetingId,
    shareId,
  });

  return resp.data;
};
