import axios from "axios";
import { google } from "googleapis";
import LitJsSdk from "lit-js-sdk";
import { authUser } from "../auth.js";
import { OAuth2Client } from "google-auth-library";
import { parseJwt, sendSlackMetricsReportMessage } from "../utils.js";

export default async function (fastify, opts) {
  // store the user's access token
  // 2022-3-27 - new endpoints for google identity services

  fastify.get("/api/oauth/google/callback", async (req, res) => {
    // response.redirect(`${process.env.LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/google`);
    console.log("start of google callback");
    const { state, code } = req.query;
    if (!state) {
      res.code(400);
      return { error: "Invalid signature" };
    }
    const authSig = JSON.parse(state);

    if (!authUser(authSig)) {
      res.code(400);
      return { error: "Invalid signature" };
    }

    console.log("middle of google callback");

    const oauth_client = new OAuth2Client(
      process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}/api/oauth/google/callback`
    );

    const { tokens } = await oauth_client.getToken(code);
    console.log("tokens from google", tokens);

    oauth_client.setCredentials(tokens);

    const parsedJwt = parseJwt(tokens.id_token);
    const idOnService = parsedJwt.sub;

    const drive = google.drive({
      version: "v3",
      auth: oauth_client,
    });

    let about_info;
    try {
      about_info = await drive.about.get({
        fields: "user",
      });
    } catch (err) {
      const errorObject = {
        errorStatus: err.code,
        errors: err.errors,
      };
      return errorObject;
    }

    const existingRows = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("user_id", "=", authSig.address);

    let connected_service_id;

    if (existingRows.length > 0) {
      // okay the token already exists, just update it
      await fastify.objection.models.connectedServices
        .query()
        .where("service_name", "=", "google")
        .where("user_id", "=", authSig.address)
        .patch({
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
        });
    } else {
      // insert
      const query = await fastify.objection.models.connectedServices
        .query()
        .insert({
          id_on_service: idOnService,
          email: about_info.data.user.emailAddress,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          access_token: tokens.access_token,
          extra_data: about_info.data.user,
          user_id: authSig.address,
          service_name: "google",
        });
      connected_service_id = query.id;

      await sendSlackMetricsReportMessage({
        msg: `Google account connected ${about_info.data.user.emailAddress} - ${authSig.address}`,
      });
    }

    res.redirect(
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/google`
    );
  });

  fastify.post("/api/google/checkIfUserExists", async (request, response) => {
    const { authSig } = request.body;
    console.log("start of checkIfUserExists");

    if (!authUser(authSig)) {
      response.code(400);
      return { error: "Invalid signature" };
    }

    let userExists = false;

    const existingRows = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("user_id", "=", authSig.address);

    console.log("checkExistingRows", existingRows);

    const oauth_client = new OAuth2Client(
      process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}/api/oauth/google/callback`
    );

    // let tokenExpiresSoon = await oauth_client.isTokenExpiring();

    if (existingRows.length && !!existingRows[0].accessToken) {
      oauth_client.setCredentials({
        refresh_token: existingRows[0].refreshToken,
      });

      userExists = true;
      const newTokens = await oauth_client.refreshAccessToken();

      const drive = google.drive({
        version: "v3",
        auth: oauth_client,
      });

      let about_info;
      try {
        about_info = await drive.about.get({
          fields: "user",
        });
      } catch (err) {
        const errorObject = {
          errorStatus: err.code,
          errors: err.errors,
        };
        return errorObject;
      }

      await fastify.objection.models.connectedServices
        .query()
        .where("service_name", "=", "google")
        .where("user_id", "=", authSig.address)
        .patch({
          refresh_token: newTokens.credentials.refresh_token,
          access_token: newTokens.credentials.access_token,
          scope: newTokens.credentials.scope,
          extra_data: about_info.data.user,
          email: about_info.data.user.emailAddress,
        });
    }

    return userExists;
  });

  fastify.post("/api/google/getUserProfile", async (request, response) => {
    const { authSig } = request.body;

    if (!authUser(authSig)) {
      response.code(400);
      return { error: "Invalid signature" };
    }

    const existingRows = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("user_id", "=", authSig.address);

    const { scope, extraData, idOnService, email, accessToken } =
      existingRows[0];
    return {
      scope,
      extraData,
      idOnService,
      email,
      accessToken,
    };
  });

  fastify.post("/api/google/getAllShares", async (req, res) => {
    const authSig = req.body.authSig;
    const idOnService = req.body.idOnService;
    if (!authUser(authSig)) {
      res.code(400);
      return { error: "Invalid signature" };
    }

    const connectedService = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("user_id", "=", authSig.address);

    const recoveredShares = await fastify.objection.models.shares
      .query()
      // .where("connected_service_id", "=", connectedService[0].id)
      .where("user_id", "=", connectedService[0].userId);

    return recoveredShares;
  });

  fastify.post("/api/google/deleteShare", async (req, res) => {
    const shareUuid = req.body.uuid;
    return await fastify.objection.models.shares
      .query()
      .delete()
      .where("id", "=", shareUuid);
  });

  fastify.post("/api/google/share", async (req, res) => {
    const {
      authSig,
      connectedServiceId,
      token,
      idOnService,
      accessControlConditions,
      source,
    } = req.body;
    if (!authUser(authSig)) {
      res.code(400);
      return { error: "Invalid signature" };
    }

    const connectedService = (
      await fastify.objection.models.connectedServices
        .query()
        .where("service_name", "=", "google")
        .where("user_id", "=", authSig.address)
    )[0];

    const oauth_client = new google.auth.OAuth2(
      process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      "postmessage"
    );

    oauth_client.setCredentials({
      access_token: token,
      refresh_token: connectedService.refreshToken,
    });

    const drive = google.drive({
      version: "v3",
      auth: oauth_client,
    });

    const fileInfo = await drive.files.get({
      fileId: req.body.driveId,
    });

    let daoAddress = null;
    // check if daohaus and dao contract address
    // looking for standardContractType: 'MolochDAOv2.1',
    if (
      source &&
      source === "daohaus" &&
      accessControlConditions[0].standardContractType === "MolochDAOv2.1"
    ) {
      daoAddress = accessControlConditions[0].contractAddress;
    }

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
        source,
        dao_address: daoAddress,
      });

    let uuid = await insertToLinksQuery.id;

    await sendSlackMetricsReportMessage({
      msg: `Google doc shared by ${connectedService.email} - ${authSig.address}`,
    });

    return {
      authorizedControlConditions: req.body.accessControlConditions,
      uuid,
    };
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
    const requestedEmail = req.body.email;
    const role = req.body.role;
    const uuid = req.body.uuid;
    const jwt = req.body.jwt;
    // TODO: expand security
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

    try {
      await drive.permissions.create({
        resource: permission,
        fileId: share.assetIdOnService,
        fields: "id",
      });
    } catch (err) {
      return err;
    }

    // Send drive ID back and redirect
    return { fileId: share.assetIdOnService };
  });

  fastify.post("/api/google/signOutUser", async (request, response) => {
    const { authSig } = request.body;

    if (!authUser(authSig)) {
      response.code(400);
      return { error: "Invalid signature" };
    }

    const results = await fastify.objection.models.connectedServices
      .query()
      .where("service_name", "=", "google")
      .where("user_id", "=", authSig.address)
      .patch({ access_token: null });

    return true;
  });

  fastify.post("/api/google/getDAOShares", async (req, res) => {
    const daoAddress = req.body.daoAddress;

    const shares = await fastify.objection.models.shares
      .query()
      .where("dao_address", "=", daoAddress)
      .where("source", "=", "daohaus");

    return shares;
  });

  // TODO: remove before
  // fastify.post("/api/google/deleteConnectedService", async (req, res) => {
  //   console.log('/api/google/deleteShare', req.body)
  //   const uuid = req.body;
  //   // console.log('shareuuid', uuid)
  //
  //   return await fastify.objection.models.connectedServices
  //     .query()
  //     .where('service_name', '=', 'google')
  //     .delete();
  // });
  //
  //
  // fastify.post("/api/google/checkConnectedService", async (req, res) => {
  //   console.log('/api/google/checkConnectedService', req.body)
  //   const email = req.body;
  //   // console.log('shareuuid', uuid)
  //   const result = await fastify.objection.models.connectedServices
  //     .query()
  //     .where("email", "=", email);
  //
  //   const allEntries = await fastify.objection.models.connectedServices
  //     .query()
  //
  //   return { result, length: allEntries.length };
  // });
  //
  // fastify.get("/api/google/testEndpoint", async (request, response) => {
  //   console.log('test endpoint successfull')
  //   return 'test endpoint successfull'
  // })
}
