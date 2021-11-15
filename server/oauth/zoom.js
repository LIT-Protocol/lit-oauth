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
import axios from "axios";

export default async function (fastify, opts) {
  fastify.post("/api/oauth/zoom/serviceLogin", async (request, reply) => {
    const {authSig} = request.body;

    if (!authUser(authSig)) {
      reply.code(400);
      return {error: "Invalid signature"};
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

  fastify.post("/api/zoom/serviceLogout", async (request, reply) => {
    const user = request.body.user
    console.log('DELETE REQUEST', request.body.user)

    // fastify.delete(`http://zoom.us/oauth/users/${user}/token`)
    await axios.delete(`https://zoom.us/oauth/users/${user}/token`).then(res => {
      console.log('RESULT OF DELETE USER', res)
      return res;
    }).catch(err => {
      console.log('DELETE ERR', err)
    });
  })

  fastify.get("/api/oauth/zoom/callback", async (request, reply) => {
    const {state} = request.query;
    const {authSig} = JSON.parse(state);

    if (!authUser(authSig)) {
      reply.code(400);
      return {error: "Invalid signature"};
    }
    const userId = authSig.address;

    const data = await getAccessToken({code: request.query.code});
    const accessToken = data.access_token;

    const user = await getUser({accessToken});
    console.log("user", user);

    // check for existing access token
    const service = (
      await fastify.objection.models.connectedServices
        .query()
        .where("user_id", "=", userId)
        .where("id_on_service", "=", user.id)
    )[0];

    if (service) {
      // update
      // store access token and user info
      service.patch({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
    } else {
      // insert
      // store access token and user info

      await fastify.objection.models.connectedServices.query().insert({
        userId: authSig.address,
        serviceName: "zoom",
        idOnService: user.id,
        email: user.email,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope,
        extraData: JSON.stringify({token: data, user}),
      });
    }

    reply.redirect(`${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/zoom`);
  });

  fastify.post("/api/zoom/getServiceInfo", async (request, reply) => {
    const authSig = request.body.authSig;
    let connectedService = fastify.objection.models.connectedServices.query()
      .where('user_id', '=', authSig.address)
      .where('service_name', '=', 'zoom');

    // if (connectedService.length) {
    //   const refreshTokenArgs = {
    //     connectedServiceId: connectedService[0].id,
    //     refreshToken: connectedService[0].refresh_token,
    //     accessToken: connectedService[0].access_token,
    //     fastify,
    //     req: request
    //   }
    //   await refreshTokenIfNeeded(refreshTokenArgs);
    //
    //   connectedService = fastify.objection.models.connectedServices.query()
    //     .where('user_id', '=', authSig.address)
    //     .where('service_name', '=', 'zoom');
    // }

    delete connectedService.refresh_token;

    return connectedService;
  });

  fastify.post("/api/zoom/meetingsAndWebinars", async (request, reply) => {
    const {authSig} = request.body;

    if (!authUser(authSig)) {
      reply.code(400);
      return {error: "Invalid signature"};
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
        return {...service, shares};
      })
    );

    console.log('GET MEETING AND WEBINARS ZOOM.JS')

    const meetingsAndWebinars = (
      await Promise.all(
        services.map((s) => {
          return getMeetingsAndWebinars({
            accessToken: s.accessToken,
            refreshToken: s.refreshToken,
            connectedServiceId: s.id,
            fastify,
            shares: s.shares,
          })
        })
      )
    )
      .flat()
      .filter((mw) => new Date(mw.start_time) > new Date());

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

    const shares = await fastify.objection.models.shares
      .query()
      // .where("asset_id_on_service", "=", meetingId);
      .where("id", "=", meetingId);

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

  fastify.post('/api/zoom/getSingleShare', async (req, res) => {
    const uuid = req.body.uuid;

    return await fastify.objection.models.shares.query()
      .where('id', '=', uuid);
  })

  fastify.post('/api/zoom/getAllShares', async (req, res) => {
    const authSig = req.body.authSig;
    const connectedService =  await fastify.objection.models.connectedServices.query()
      .where('service_name', '=', 'zoom')
      .where('user_id', '=', authSig.address);

    return await fastify.objection.models.shares.query()
      .where('connected_service_id', '=', connectedService[0].id)
      .where('user_id', '=', authSig.address);
  })

  fastify.post("/api/zoom/getMeetingUrl", async (request, reply) => {
    const { jwt, assetType, assetIdOnService, shareId } = request.body;

    // verify the jwt
    const { verified, header, payload } = LitJsSdk.verifyJwt({ jwt });
    const userId = payload.sub;

    // The "verified" variable is a boolean that indicates whether or not the signature verified properly.
    // Note: YOU MUST CHECK THE PAYLOAD AGAINST THE CONTENT YOU ARE PROTECTING.
    // This means you need to look at "payload.baseUrl" which should match the hostname of the server, and you must also look at "payload.path" which should match the path being accessed, and you must also look at payload.orgId, payload.role, and payload.extraData which will probably be empty
    // If these do not match what you're expecting, you should reject the request!!

    const sharedLinkPath = getSharingLinkPath({ id: shareId });

    const extraData = JSON.stringify({
      shareId: shareId,
      assetIdOnService: assetIdOnService,
      assetType: assetType
    });

    console.log("payload is", payload);
    console.log("correct extra data is ", extraData);
    console.log("shared link path is", sharedLinkPath);

    console.log('CHECK CONDITIONS FOR SUCCESS', {
      verified: verified,
      baseUrl: `${payload.baseUrl} || ${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}`,
      path: `${payload.path} || ${sharedLinkPath}`,
      orgId: `${payload.orgId}`,
      role: `${payload.role}`,
      extraData1: JSON.parse(payload.extraData),
      extraData2: JSON.parse(extraData)
    })

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
    const meeting = (
      await fastify.objection.models.shares
        .query()
        .where("asset_id_on_service", "=", assetIdOnService)
    )[0];

    const service = (
      await fastify.objection.models.connectedServices
        .query()
        .where("id", "=", meeting.connectedServiceId)
    )[0];

    // grant access on zoom api
    const { joinUrl } = await createMeetingInvite({
      accessToken: service.accessToken,
      refreshToken: service.refreshToken,
      connectedServiceId: service.id,
      fastify,
      userId,
      meetingId: assetIdOnService,
      assetType: assetType,
    });

    return {
      joinUrl,
    };
  });

  fastify.post('/api/zoom/deleteShare', async(req, res) => {
    const shareUuid = req.body.uuid;
    return await fastify.objection.models.shares.query().delete()
      .where('id', '=', shareUuid);
  })

  fastify.post("/api/zoom/shareMeeting", async (request, reply) => {
    const { authSig, meeting, accessControlConditions } = request.body;

    if (!authUser(authSig)) {
      reply.code(400);
      return { error: "Invalid signature" };
    }
    const userId = authSig.address;

    // delete old shares
    await fastify.objection.models.shares
      .query()
      .delete()
      .where("user_id", "=", userId)
      .where("asset_id_on_service", "=", meeting.id)
      .where("connected_service_id", "=", meeting.connectedServiceId);

    // store the new share
    await fastify.objection.models.shares.query().insert({
      userId,
      connectedServiceId: meeting.connectedServiceId,
      asset_id_on_service: meeting.id,
      access_control_conditions: JSON.stringify(accessControlConditions),
      name: meeting.topic,
      asset_type: meeting.type,
    });

    const mostRecentShare = await fastify.objection.models.shares.query()
      .where('asset_id_on_service', '=', meeting.id)
      .where('connectedServiceId', '=', meeting.connectedServiceId)
      .where('userId', '=', userId)
      .where('name', '=', meeting.topic)

    return mostRecentShare;
  });


  // // TODO: remove this
  fastify.post('/api/zoom/deleteUser', async (request, reply) => {
    const {address, idOnService} = request.body
    const shareResponse = (
      await fastify.objection.models.shares
        .query()
        .delete()
        .where("user_id", "=", address)
    )

    const response = (
      await fastify.objection.models.connectedServices
        .query()
        .delete()
        .where("user_id", "=", address)
        .where("id_on_service", "=", idOnService)
    )

    return response;
  })
}
