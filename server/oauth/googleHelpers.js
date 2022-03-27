import jwt from "jsonwebtoken";

export const validateJWT = async (token) => {
  const result = jwt.verify(token, process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET);
  return result;
}

export const tokenIsValid = (authSig, jwtResult) => {
  if (authSig.sig === jwtResult.sig && authSig.address == jwtResult.address) {
    return true;
  } else {
    return false;
  }
}
