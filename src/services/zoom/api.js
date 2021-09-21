import axios from "axios";
import LitJsSdk from "lit-js-sdk";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const getMeetings = async () => {
  const authSig = await LitJsSdk.checkAndSignAuthMessage({
    chain: "ethereum",
  });

  const resp = await axios.post(`${API_HOST}/api/zoom/meetings`, {
    authSig,
  });

  return resp.data;
};

export const createMeetingShare = async (body) => {
  const authSig = await LitJsSdk.checkAndSignAuthMessage({
    chain: "ethereum",
  });

  const resp = await axios.post(`${API_HOST}/api/zoom/shareMeeting`, {
    ...body,
    authSig,
  });

  return resp.data;
};
