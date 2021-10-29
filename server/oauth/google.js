import { google } from "googleapis";
import LitJsSdk from "lit-js-sdk";
import { authUser } from "../auth.js";
import { parseJwt } from "../utils.js";

export default async function (fastify, opts) {
  // store the user's access token
  fastify.post("/api/google/connect", async (req, res) => {
    const { authSig, token } = req.body;
    if (!authUser(authSig)) {
      res.code(400);
      return { error: "Invalid signature" };
    }

    // First - get Google Drive refresh token (given acct email and drive)
    const oauth_client = new google.auth.OAuth2(
      process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      "postmessage"
    );
    const { tokens } = await oauth_client.getToken(token);
    oauth_client.setCredentials(tokens);

    const parsedJwt = parseJwt(tokens.id_token);
    const idOnService = parsedJwt.sub;

    const drive = google.drive({
      version: "v3",
      auth: oauth_client,
    });
    const about_info = await drive.about.get({
      fields: "user",
    });

    const existingRows = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("id_on_service", "=", idOnService);

    let connected_service_id;

    if (existingRows.length > 0) {
      // okay the token already exists, just update it
      existingRows[0].patch({
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
      });
      connected_service_id = existingRows[0].id;
    } else {
      // insert
      const query = await fastify.objection.models.connectedServices
        .query()
        .insert({
          id_on_service: idOnService,
          email: about_info.data.user.emailAddress,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          extra_data: about_info.data.user,
          user_id: authSig.address,
          service_name: "google",
        });
      connected_service_id = query.id;
    }

    console.log("CONNECTED SERVICE DECLARE", connected_service_id);

    const connectedGoogleServices =
      await fastify.objection.models.connectedServices
        .query()
        .where("user_id", "=", authSig.address)
        .where("service_name", "=", "google");
    const serialized = connectedGoogleServices.map((s) => ({
      id: s.id,
      email: s.email,
      idOnService: s.id_on_service,
    }));

    return { connectedServices: serialized };
  });

  fastify.get('/api/google/getAllShares', async (req, res) => {
    return await fastify.objection.models.shares.query();
  })

  fastify.post('/api/google/deleteShare', async(req, res) => {
    const shareUuid = req.body.uuid;
    return await fastify.objection.models.shares.query().delete()
      .where('id', '=', shareUuid);
  })

  fastify.post("/api/google/verifyToken", async (req, res) => {
    const { id_token, access_token, email } =  req.body.googleAuthResponse;
    const authSig = req.body.authSig;

    const oauth_client = new google.auth.OAuth2(
      process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID
    );

    const ticket = await oauth_client.verifyIdToken({
      idToken: id_token,
      audience: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const userId = payload["sub"];

    const existingRows = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("id_on_service", "=", userId);

    console.log('EXISTING ROWS', existingRows)

    if (!existingRows.length) {
      res.code(400);
      return { error: 'User not found.' };
    }

    if (
      payload.aud !== process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID
      || userId !== existingRows[0].idOnService
    ) {
      res.code(400);
      return { error: "Invalid signature" };
    }

    existingRows[0].patch({
      access_token: access_token,
      email: email,
    });

    const connectedGoogleServices =
      await fastify.objection.models.connectedServices
        .query()
        .where("user_id", "=", authSig.address)
        .where("id_on_service", "=", userId)
        .where("service_name", "=", "google");

    const serialized = connectedGoogleServices.map((s) => ({
      id: s.id,
      email: s.email,
      idOnService: s.id_on_service,
    }));

    // TODO: replace with google user photo
    const avatar = payload.name.split(' ').map(s => s.split('')[0]).join('');

    const userProfile = {
      email: payload.email,
      displayName: payload.name,
      givenName: payload.given_name,
      avatar: avatar
    };

    return { connectedServices: serialized, userId, userProfile };
  });

  fastify.post("/api/google/getUserProfile", async (req, res) => {
    const uniqueId = req.body.uniqueId.toString();
    const connectedServices = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("id_on_service", "=", uniqueId)
      .where("user_id", '=', req.body.authSig.address)

    delete connectedServices[0].refreshToken;
    return connectedServices;
  })

  fastify.post("/api/google/share", async (req, res) => {
    console.log("REQ BODY", req.body);
    const { authSig, connectedServiceId } = req.body;
    if (!authUser(authSig)) {
      res.code(400);
      return { error: "Invalid signature" };
    }

    const connectedService = (
      await fastify.objection.models.connectedServices
        .query()
        .where("user_id", "=", authSig.address)
        // .where("id", "=", connectedServiceId)
    )[0];

    const oauth_client = new google.auth.OAuth2(
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      "postmessage"
    );

    oauth_client.setCredentials({
      access_token: connectedService.accessToken,
      refresh_token: connectedService.refreshToken,
    });

    const drive = google.drive({
      version: "v3",
      auth: oauth_client,
    });
    console.log("CONNECTED SERVICE", connectedService);
    const fileInfo = await drive.files.get({
      fileId: req.body.driveId,
    });

    const insertToLinksQuery = await fastify.objection.models.shares
      .query()
      .insert({
        asset_id_on_service: req.body.driveId,
        access_control_conditions: JSON.stringify(
          req.body.accessControlConditions
        ),
        connected_service_id: connectedService.id,
        role: req.body.role,
        user_id: authSig.address,
        name: fileInfo.data.name,
        asset_type: fileInfo.data.mimeType,
      });

    let uuid = await insertToLinksQuery.id;

    return {
      authorizedControlConditions: req.body.accessControlConditions,
      uuid,
    };
  });

  // TODO make this use objectionjs models
  fastify.post("/api/google/delete", async (req, res) => {
    const uuid = req.body.uuid;
    // get email from token
    const oauth_client = new google.auth.OAuth2(
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      "postmessage"
    );
    const { tokens } = await oauth_client.getToken(req.body.token);
    oauth_client.setCredentials(tokens);

    const drive = google.drive({
      version: "v3",
      auth: oauth_client,
    });

    const about_info = await drive.about.get({
      fields: "user",
    });

    let email = about_info.data.user.emailAddress;
    const query = {
      text: "DELETE FROM links USING links AS l LEFT OUTER JOIN sharers ON l.sharer_id = sharers.id WHERE links.id = l.id AND links.id = $1 AND sharers.email = $2",
      values: [uuid, email],
    };

    let deleted_row = await runQuery(query);

    if (deleted_row === "error") {
      return res.status(400).send();
    } else {
      return res.status(200).send();
    }
  });

  fastify.post("/api/google/conditions", async (req, res) => {
    const uuid = req.body.uuid;

    const share = (
      await fastify.objection.models.shares.query().where("id", "=", uuid)
    )[0];

    return { share };
  });

  fastify.post("/api/google/shareLink", async (req, res) => {
    // Check the supplied JWT
    console.log('REQ FINAL SHARELINK', req.body)
    const requestedEmail = req.body.email;
    const role = req.body.role;
    const uuid = req.body.uuid;
    const jwt = req.body.jwt;
    const { verified, header, payload } = LitJsSdk.verifyJwt({ jwt });
    if (
      !verified ||
      payload.baseUrl !==
        `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}` ||
      payload.path !== "/google/l/" + uuid ||
      payload.orgId !== "" ||
      payload.role !== role ||
      payload.extraData !== ""
    ) {
      res.end("JWT verification failed.");
      return;
    }

    const share = (
      await fastify.objection.models.shares.query().where("id", "=", uuid)
    )[0];

    const connectedService = (
      await fastify.objection.models.connectedServices
        .query()
        .where("id", "=", share.connectedServiceId)
    )[0];

    const oauth_client = new google.auth.OAuth2(
      process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      "postmessage"
    );

    oauth_client.setCredentials({
      access_token: connectedService.accessToken,
      refresh_token: connectedService.refreshToken,
    });

    const permission = {
      type: "user",
      role: share.role,
      emailAddress: requestedEmail,
    };
    const drive = google.drive({
      version: "v3",
      auth: oauth_client,
    });

    console.log('FILEID', share)

    await drive.permissions.create({
      resource: permission,
      fileId: share.assetIdOnService,
      fields: "id",
    });

    // Send drive ID back and redirect
    return { fileId: share.assetIdOnService };
  });

  fastify.get("/api/oauth/google/callback", async (request, response) => {
    response.redirect(process.env.LIT_PROTOCOL_OAUTH_FRONTEND_HOST);
  });
}
