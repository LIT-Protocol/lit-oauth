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

export const getMeetingsAndWebinars = async ({
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
      // pull meetings
      let q = {
        type: "scheduled",
        page_size: 300,
      };
      let url =
        "https://api.zoom.us/v2/users/me/meetings?" +
        new URLSearchParams(q).toString();
      let resp = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const meetingsWithServiceId = resp.data.meetings.map((d) => ({
        ...d,
        connectedServiceId,
        shares: shares.filter((s) => s.assetIdOnService === d.id.toString()),
        type: "meeting",
      }));

      // pull webinars
      q = {
        page_size: 300,
      };
      url =
        "https://api.zoom.us/v2/users/me/webinars?" +
        new URLSearchParams(q).toString();
      resp = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const webinarsWithServiceId = resp.data.webinars.map((d) => ({
        ...d,
        connectedServiceId,
        shares: shares.filter((s) => s.assetIdOnService === d.id.toString()),
        type: "webinar",
      }));

      return [...meetingsWithServiceId, ...webinarsWithServiceId];
    },
  });
};

export const createMeetingInvite = async ({
  accessToken,
  refreshToken,
  connectedServiceId,
  fastify,
  userId,
  meetingId,
  assetType,
}) => {
  return refreshTokenIfNeeded({
    accessToken,
    refreshToken,
    fastify,
    connectedServiceId,
    req: async (accessToken) => {
      let url;
      if (assetType === "meeting") {
        url = `https://api.zoom.us/v2/meetings/${meetingId}/invite_links`;
      } else {
        // must be webinar
        url = `https://api.zoom.us/v2/webinars/${meetingId}/invite_links`;
      }
      const resp = await axios.post(
        url,
        {
          attendees: [
            {
              name: userId,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const joinUrl = resp.data.attendees[0].join_url;

      return { joinUrl };
    },
  });
};

const refreshAccessToken = async ({
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

  await fastify.objection.models.connectedServices
    .query()
    .update({
      accessToken: resp.data.access_token,
      refreshToken: resp.data.refresh_token,
    })
    .where("id", "=", connectedServiceId);

  return resp.data.access_token;
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
    if (e.response) {
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
      }
    } else {
      throw e;
    }
  }
};
