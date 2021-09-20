import { recoverPersonalSignature } from "eth-sig-util";

export const authUser = (authSig) => {
  // verify the user's sig
  const msgParams = {
    data: "0x" + Buffer.from(authSig.signedMessage, "utf8").toString("hex"),
    sig: authSig.sig,
  };
  const verifiedSender = recoverPersonalSignature(msgParams);
  if (!verifiedSender || verifiedSender !== authSig.address) {
    return false;
  }
  return true;
};
