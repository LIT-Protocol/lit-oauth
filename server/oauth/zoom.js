import { authUser } from "../auth.js";
import { keysToCamel } from "../utils.js";
import LitJsSdk from "lit-js-sdk";
import { getSharingLinkPath } from "../../src/pages/zoom/utils.js";
import {
  getAccessToken,
  getUser,
  getMeetingsAndWebinars,
  createMeetingInvite,
} from "./zoomHelpers.js";

export default async function (fastify, opts) {
  fastify.post("/api/oauth/zoom/login", async (request, reply) => {
    const { authSig } = request.body;

    if (!authUser(authSig)) {
      reply.code(400);
      return { error: "Invalid signature" };
    }

    const q = {
      response_type: "code",
      client_id: process.env.LIT_PROTOCOL_OAUTH_ZOOM_CLIENT_ID,
      redirect_uri: process.env.LIT_PROTOCOL_OAUTH_ZOOM_REDIRECT_URL,
      state: JSON.stringify({
        authSig,
      }),
    };

    reply.send({
      redirectTo:
        "https://zoom.us/oauth/authorize?" + new URLSearchParams(q).toString(),
    });
  });

  fastify.get("/api/oauth/zoom/callback", async (request, reply) => {
    const { state } = request.query;
    console.log("state from zoom", state);
    const { authSig } = JSON.parse(state);
    console.log("authSig from zoom", authSig);

    if (!authUser(authSig)) {
      reply.code(400);
      return { error: "Invalid signature" };
    }
    const userId = authSig.address;

    const data = await getAccessToken({ code: request.query.code });
    const accessToken = data.access_token;

    const user = await getUser({ accessToken });
    console.log("user", user);

    // check for existing access token
    const service = (
      await fastify.pg.query(
        "SELECT id FROM connected_services WHERE user_id=$1 AND id_on_service=$2",
        [userId, user.id]
      )
    ).rows[0];

    if (service) {
      // update
      // store access token and user info
      await fastify.pg.transact(async (client) => {
        // will resolve to an id, or reject with an error
        await client.query(
          "UPDATE connected_services SET access_token=$1, refresh_token=$2 WHERE id=$3",
          [data.access_token, data.refresh_token, service.id]
        );
      });
    } else {
      // insert
      // store access token and user info
      await fastify.pg.transact(async (client) => {
        // will resolve to an id, or reject with an error
        const id = await client.query(
          "INSERT INTO connected_services(user_id, service_name, id_on_service, email, created_at, access_token, refresh_token, extra_data, scope) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
          [
            authSig.address,
            "zoom",
            user.id,
            user.email,
            new Date(),
            data.access_token,
            data.refresh_token,
            JSON.stringify({ token: data, user }),
            data.scope,
          ]
        );

        // potentially do something with id
        return id;
      });
    }

    reply.redirect(process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST);
  });

  fastify.post("/api/zoom/meetingsAndWebinars", async (request, reply) => {
    const { authSig } = request.body;

    if (!authUser(authSig)) {
      reply.code(400);
      return { error: "Invalid signature" };
    }
    const userId = authSig.address;

    let services = await fastify.objection.models.connectedServices
      .query()
      .where("user_id", "=", userId)
      .where("service_name", "=", "zoom");

    // add shares
    services = await Promise.all(
      services.map(async (service) => {
        const shares = await fastify.objection.models.shares
          .query()
          .where("connected_service_id", "=", service.id);
        // console.log("got shares", shares);
        return { ...service, shares };
      })
    );

    const meetingsAndWebinars = (
      await Promise.all(
        services.map((s) =>
          getMeetingsAndWebinars({
            accessToken: s.accessToken,
            refreshToken: s.refreshToken,
            connectedServiceId: s.id,
            fastify,
            shares: s.shares,
          })
        )
      )
    )
      .flat()
      .filter((mw) => new Date(mw.start_time) > new Date());

    console.log("meetingsAndWebinars", meetingsAndWebinars);

    return {
      meetingsAndWebinars,
    };
  });

  // get shares for a given meeting
  fastify.post("/api/zoom/shares", async (request, reply) => {
    const { authSig, meetingId } = request.body;

    if (!authUser(authSig)) {
      reply.code(400);
      return { error: "Invalid signature" };
    }
    const userId = authSig.address;

    let shares = (
      await fastify.pg.query(
        "SELECT * FROM shares WHERE asset_id_on_service=$1",
        [meetingId]
      )
    ).rows;

    return {
      shares: shares.map((s) => {
        const share = keysToCamel(s);
        share.accessControlConditions = JSON.parse(
          share.accessControlConditions
        );
        return share;
      }),
    };
  });

  fastify.post("/api/zoom/getMeetingUrl", async (request, reply) => {
    const { jwt, meetingId, shareId } = request.body;

    // verify the jwt
    const { verified, header, payload } = LitJsSdk.verifyJwt({ jwt });
    const userId = payload.sub;

    // The "verified" variable is a boolean that indicates whether or not the signature verified properly.
    // Note: YOU MUST CHECK THE PAYLOAD AGAINST THE CONTENT YOU ARE PROTECTING.
    // This means you need to look at "payload.baseUrl" which should match the hostname of the server, and you must also look at "payload.path" which should match the path being accessed, and you must also look at payload.orgId, payload.role, and payload.extraData which will probably be empty
    // If these do not match what you're expecting, you should reject the request!!

    const sharedLinkPath = getSharingLinkPath({ id: meetingId });

    const extraData = JSON.stringify({
      shareId,
    });

    console.log("payload is", payload);
    console.log("correct extra data is ", extraData);
    console.log("shared link path is", sharedLinkPath);

    if (
      !verified ||
      payload.baseUrl !==
        process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST ||
      payload.path !== sharedLinkPath ||
      payload.orgId !== "" ||
      payload.role !== "" ||
      payload.extraData !== extraData
    ) {
      // Reject this request!
      return { success: false, errorCode: "not_authorized" };
    }

    // get the meeting and oauth creds
    let meeting = (
      await fastify.pg.query(
        "SELECT * FROM shares WHERE asset_id_on_service=$1",
        [meetingId]
      )
    ).rows[0];

    let service = (
      await fastify.pg.query("SELECT * FROM connected_services WHERE id=$1", [
        meeting.connected_service_id,
      ])
    ).rows[0];

    // grant access on zoom api
    const { joinUrl } = await createMeetingInvite({
      accessToken: service.access_token,
      refreshToken: service.refresh_token,
      connectedServiceId: service.id,
      fastify,
      userId,
      meetingId,
      assetType: meeting.asset_type,
    });

    return {
      joinUrl,
    };
  });

  fastify.post("/api/zoom/shareMeeting", async (request, reply) => {
    const { authSig, meeting, accessControlConditions } = request.body;

    if (!authUser(authSig)) {
      reply.code(400);
      return { error: "Invalid signature" };
    }
    const userId = authSig.address;

    await fastify.pg.transact(async (client) => {
      // will resolve to an id, or reject with an error
      const id = await client.query(
        "DELETE FROM shares WHERE user_id=$1 AND asset_id_on_service=$2",
        [userId, meeting.id]
      );

      // potentially do something with id
      return id;
    });

    // store the share
    await fastify.pg.transact(async (client) => {
      // will resolve to an id, or reject with an error
      const id = await client.query(
        "INSERT INTO shares(user_id, connected_service_id, asset_id_on_service, access_control_conditions, name, asset_type) VALUES($1, $2, $3, $4, $5, $6) RETURNING id",
        [
          authSig.address,
          meeting.connectedServiceId,
          meeting.id,
          JSON.stringify(accessControlConditions),
          meeting.topic,
          meeting.type,
        ]
      );

      // potentially do something with id
      return id;
    });

    return {
      success: true,
    };
  });
}
