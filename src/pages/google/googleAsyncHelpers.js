import axios from "axios";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const checkIfUserExists = async (authSig) => {
  return await axios.post(`${API_HOST}/api/google/checkIfUserExists`, {
    authSig,
  });
};

export const getUserProfile = async (authSig) => {
  return await axios.post(`${API_HOST}/api/google/getUserProfile`, {
    authSig,
  });
};

export const share = async (requestData, requestOptions) => {
  const {
    driveId,
    role,
    token,
    connectedServiceId,
    accessControlConditions,
    authSig,
    idOnService,
    extraData,
    permanent,
    authSigTypes
  } = requestData;
  console.log('check google share request data', requestData)
  return await axios.post(
    API_HOST + "/api/google/share",
    {
      driveId,
      role,
      token,
      connectedServiceId,
      accessControlConditions,
      authSig,
      idOnService,
      extraData,
      permanent,
      authSigTypes
    },
    requestOptions
  );
};

export const getAllShares = async (authSig, idOnService) => {
  return await axios.post(`${API_HOST}/api/google/getAllShares`, {
    authSig,
    idOnService,
  });
};

export const deleteShare = async (shareUuid) => {
  return await axios.post(`${API_HOST}/api/google/deleteShare`, {
    uuid: shareUuid,
  });
};

// export const deleteConnectedService = async (shareUuid) => {
//   return await axios.post(`${API_HOST}/api/google/deleteShare`, shareUuid);
// }

export const signOutUser = async (authSig) => {
  return await axios.post(`${API_HOST}/api/google/signOutUser`, {
    authSig,
  });
};
