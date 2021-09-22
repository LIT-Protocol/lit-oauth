import axios from "axios";

export const getAccessToken = async ({ code }) => {
  const q = {
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.LIT_PROTOCOL_OAUTH_ZOOM_REDIRECT_URL,
  };
  const url =
    "https://zoom.us/oauth/token?" + new URLSearchParams(q).toString();

  const encodedZoomCredentials = Buffer.from(
    `${process.env.LIT_PROTOCOL_OAUTH_ZOOM_CLIENT_ID}:${process.env.LIT_PROTOCOL_OAUTH_ZOOM_SECRET}`
  ).toString("base64");

  const resp = await axios.post(
    url,
    {},
    {
      headers: {
        Authorization: `Basic ${encodedZoomCredentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  // console.log("resp from zoom with access tokens", resp.data);

  return resp.data;
};

export const getUser = async ({ accessToken, refreshToken }) => {
  const user = await axios.get("https://api.zoom.us/v2/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return user.data;
};

export const getMeetings = async ({
  accessToken,
  refreshToken,
  connectedServiceId,
  fastify,
  shares,
}) => {
  return refreshTokenIfNeeded({
    accessToken,
    refreshToken,
    fastify,
    connectedServiceId,
    shares,
    req: async (accessToken) => {
      const q = {
        type: "scheduled",
        page_size: 300,
      };
      const url =
        "https://api.zoom.us/v2/users/me/meetings?" +
        new URLSearchParams(q).toString();
      const resp = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const meetingsWithServiceId = resp.data.meetings.map((d) => ({
        ...d,
        connectedServiceId,
        shares,
      }));
      return { meetings: meetingsWithServiceId };
    },
  });
};

export const refreshAccessToken = async ({
  connectedServiceId,
  refreshToken,
  fastify,
}) => {
  console.log("Refreshing zoom access token");
  const q = {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };
  const url =
    "https://zoom.us/oauth/token?" + new URLSearchParams(q).toString();

  const encodedZoomCredentials = Buffer.from(
    `${process.env.LIT_PROTOCOL_OAUTH_ZOOM_CLIENT_ID}:${process.env.LIT_PROTOCOL_OAUTH_ZOOM_SECRET}`
  ).toString("base64");

  const resp = await axios.post(
    url,
    {},
    {
      headers: {
        Authorization: `Basic ${encodedZoomCredentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  await fastify.pg.transact(async (client) => {
    // will resolve to an id, or reject with an error
    await client.query(
      "UPDATE connected_services SET access_token=$1, refresh_token=$2 WHERE id=$3",
      [resp.data.access_token, resp.data.refresh_token, connectedServiceId]
    );
  });

  return resp.data;
};

const refreshTokenIfNeeded = async ({
  accessToken,
  refreshToken,
  fastify,
  connectedServiceId,
  req,
}) => {
  try {
    const resp = await req(accessToken);
    return resp;
  } catch (e) {
    console.log("response status from axios", e.response.status);
    console.log("response code from axios", e.response.data.code);
    if (e.response.status === 401 && e.response.data.code === 124) {
      // refresh the token, then try again
      const refreshedAccessToken = await refreshAccessToken({
        refreshToken,
        fastify,
        connectedServiceId,
      });
      return req(refreshedAccessToken);
    } else {
      throw e;
    }
  }
};
