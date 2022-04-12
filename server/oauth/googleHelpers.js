// import jwt from "jsonwebtoken";
import { verify } from "jsonwebtoken";

export const validateJWT = async (token) => {
  console.log('check validateJWT', token, process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET);
  const result = verify(token, process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET);
  return result;
}
