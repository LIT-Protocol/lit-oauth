import axios from "axios";
import jwt from "jsonwebtoken";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const checkIfUserExists = async (payload) => {
  return await axios.post(
    `${API_HOST}/api/google/checkIfUserExists`,
    {
      payload
    }
  )
}

export const getUserProfile = async (payload) => {
  return await axios.post(
    `${API_HOST}/api/google/getUserProfile`,
    {
      payload
    }
  )
}

export const makeJwt = (payload) => {
  console.log('makeJWT', payload, process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET)
  const secret = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET;
  return jwt.sign(payload, secret);
}

export const share = async (requestData, requestOptions) => {
  const { driveId, role, token, connectedServiceId, accessControlConditions, authSig, idOnService } = requestData
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
  return await axios.post(`${API_HOST}/api/google/deleteShare`, { uuid: shareUuid });
}

// export const deleteConnectedService = async (shareUuid) => {
//   return await axios.post(`${API_HOST}/api/google/deleteShare`, shareUuid);
// }

export const signOutUser = async (payload) => {
  return await axios.post(
    `${API_HOST}/api/google/signOutUser`,
    {
      payload
    }
  )
}
