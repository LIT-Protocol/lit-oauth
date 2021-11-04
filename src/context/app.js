import React, { useState, useEffect, useContext, createContext } from "react";
import LitJsSdk from "lit-js-sdk";

export const AppContext = createContext({
  sideBar: true,
});

export const AppContextProvider = (props) => {
  const { children } = props;

  const [authSig, setAuthSig] = useState(null);
  const [tokenList, setTokenList] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  const performWithAuthSig = async (
    action,
    { chain } = { chain: "ethereum" }
  ) => {
    //TODO add chain selection???

    let currentAuthSig = authSig;
    if (!currentAuthSig) {
      try {
        currentAuthSig = await LitJsSdk.checkAndSignAuthMessage({ chain });
        setAuthSig(currentAuthSig);
      } catch (e) {
        console.log(e);
        if (e?.errorCode === "no_wallet") {
          setGlobalError({
            title: "You need a wallet to use the Lit Protocol",
            details: (
              <>
                Get one at{" "}
                <a href="https://metamask.io" target="_blank">
                  metamask.io
                </a>
              </>
            ),
          });
          return false;
        } else if (e?.errorCode === "wrong_network") {
          setGlobalError({
            title: e.message,
            details: "",
          });
          return false;
        } else {
          throw e;
        }
      }
    }

    return await action(currentAuthSig);
  };

  useEffect(() => {
    if (!tokenList) {
      const go = async () => {
        try {
          const tokens = await LitJsSdk.getTokenList();
          setTokenList(tokens);
        } catch(err) {
          console.log('Error fetching token list:', err)
        }
      };
      go();
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        performWithAuthSig,
        tokenList,
        setGlobalError,
        globalError,
        authSig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  return context;
};
