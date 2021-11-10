import axios from "axios";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const verifyToken = async (authSig, googleAuthResponse, idOnService) => {
  return await axios
    .post(API_HOST + "/api/google/verifyToken", {
      authSig,
      googleAuthResponse,
      idOnService
    });
}

export const getLitUserProfile = async (authSig, idOnService) => {
  return await axios
    .post(API_HOST + "/api/google/getUserProfile", {
      authSig,
      idOnService,
    });
}

export const storeConnectedServiceAccessToken = async (authSig, code) => {
  return await axios
    .post(API_HOST + "/api/google/connect", {
      authSig,
      code,
    });
}

export const share = async (requestData, requestOptions) => {
  const {driveId, role, token, connectedServiceId, accessControlConditions, authSig, idOnService} = requestData
  return await axios
    .post(
      API_HOST + "/api/google/share",
      {
        driveId,
        role,
        token,
        connectedServiceId,
        accessControlConditions,
        authSig,
        idOnService
      },
      requestOptions
    );
}

export const getAllShares = async (authSig, idOnService) => {
  return await axios.post(`${API_HOST}/api/google/getAllShares`, {
    authSig,
    idOnService
  });
}

export const deleteShare = async (shareUuid) => {
  return await axios.post(`${API_HOST}/api/google/deleteShare`, {uuid: shareUuid});
}
