import Fastify from "fastify";
import fastifyPostgres from "fastify-postgres";
import fastifyCors from "fastify-cors";
import fastifyStatic from "fastify-static";
import * as path from "path";
import axios from "axios";
import * as zoom from "./oauth/zoom.js";

import { authUser } from "./auth.js";
import { getAccessToken, getUser } from "./oauth/zoom.js";
import { keysToCamel } from "./utils.js";
import LitJsSdk from "lit-js-sdk";
import { getSharingLinkPath } from "../src/pages/zoom/utils.js";
import dotenv from 'dotenv';
import { google } from 'googleapis';
import Bugsnag from "@bugsnag/js";
import querystring from "querystring";
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config({
  path: '../.env'
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

const __dirname = path.resolve();

Bugsnag.start({
  apiKey: "0596bd3230222ad050c4533cfa5c0393",
  releaseStage: process.env.LIT_PROTOCOL_OAUTH_ENVIRONMENT,
});

const fastify = Fastify();


const dbConfig = {
  connectionString: process.env.LIT_PROTOCOL_OAUTH_DB_URL,
};

if (
  process.env.LIT_PROTOCOL_OAUTH_ZOOM_ENVIRONMENT === "production" ||
  process.env.LIT_PROTOCOL_OAUTH_ZOOM_ENVIRONMENT === "development"
) {
  dbConfig.ssl = { rejectUnauthorized: false };
}

fastify.register(fastifyPostgres, dbConfig);
fastify.register(fastifyCors, {
  origin: "*",
  methods: ["POST", "GET", "DELETE", "PUT", "PATCH"],
});

const BuildPath = path.join(__dirname, "..", "build");
fastify.register(fastifyStatic, {
  root: BuildPath,
});

fastify.setErrorHandler((error, request, reply) => {
  console.log("Fastify error: ", error);
  if (process.env.LIT_GATEWAY_ENVIRONMENT !== "local") {
    Bugsnag.notify(error);
  }
  reply.send({ error });
});

// BEGIN GOOGLE STUFF

const googleRedirectUri = 'api/oauth/google/callback';

async function runQuery(query, subfield) {
  const data = await (async () => {
    const client = await pool.connect();
    try {
      const res = await client.query(query);
      return res.rows[0];
    } finally {
      client.release();
    }
  })().catch((err) => {
    console.log(err.stack);
    throw err;
  });
  if (subfield) {
    return data[subfield];
  } else {
    return data;
  }
}

fastify.post("/api/google/share", async (req, res) => {
  // First - get Google Drive refresh token (given acct email and drive)
  console.log('LINE 99')
  const oauth_client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}/${googleRedirectUri}`
  );
  console.log('LINE 105', `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}/${googleRedirectUri}`)
  const { tokens } = await oauth_client.getToken(req.body.token);
  oauth_client.setCredentials(tokens);
  let refresh_token = "";
  if (tokens.refresh_token) {
    refresh_token = tokens.refresh_token;
  }
  console.log("LINE 112")

  // Now, get email + save information
  const drive = google.drive({
    version: "v3",
    auth: oauth_client,
  });

  const about_info = await drive.about.get({
    fields: "user",
  });
  console.log('LINE 123')

  let id = "";
  // Write to DB
  if (refresh_token !== "") {
    console.log('NO REFRESH TOKEN')
    const query = {
      text:
        "INSERT INTO sharers(email, latest_refresh_token) VALUES($1, $2) ON CONFLICT (email) DO UPDATE SET latest_refresh_token = $2 RETURNING *",
      values: [about_info.data.user.emailAddress, refresh_token],
    };

    id = await runQuery(query, "id");
  } else {
    console.log('REFRESH TOKEN')
    const query = {
      text: "SELECT id FROM sharers WHERE email = $1",
      values: [about_info.data.user.emailAddress],
    };

    id = await runQuery(query, "id");
  }
  console.log('LINE 145')

  const query = {
    text:
      "INSERT INTO links(drive_id, requirements, sharer_id, role) VALUES($1, $2, $3, $4) RETURNING *",
    values: [
      req.body.driveId,
      JSON.stringify(req.body.accessControlConditions),
      id,
      req.body.role,
    ],
  };
  console.log('LINE 157')

  let uuid = await runQuery(query, "id");
  res.end(
    JSON.stringify({
      authorizedControlConditions: req.body.accessControlConditions,
      uuid: uuid,
    })
  );
});

fastify.post("/delete", async (req, res) => {
  const uuid = req.body.uuid;
  // get email from token
  const oauth_client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}/${googleRedirectUri}`
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
    text:
      "DELETE FROM links USING links AS l LEFT OUTER JOIN sharers ON l.sharer_id = sharers.id WHERE links.id = l.id AND links.id = $1 AND sharers.email = $2",
    values: [uuid, email],
  };

  let deleted_row = await runQuery(query);

  if (deleted_row === "error") {
    return res.status(400).send();
  } else {
    return res.status(200).send();
  }
});

fastify.post("/conditions", async (req, res) => {
  const uuid = req.body.uuid;
  const query = {
    text: "SELECT requirements, role FROM links WHERE id = $1",
    values: [uuid],
  };

  let data = await runQuery(query);
  res.end(JSON.stringify(data));
});

fastify.post("/api/share", async (req, res) => {
  // Check the supplied JWT
  const requested_email = req.body.email;
  const role = req.body.role.toString();
  const uuid = req.body.uuid;
  const jwt = req.body.jwt;
  const { verified, header, payload } = LitJsSdk.verifyJwt({ jwt });
  if (
    !verified ||
    payload.baseUrl !== `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}/${googleRedirectUri}` ||
    payload.path !== "/l/" + uuid ||
    payload.orgId !== "" ||
    payload.role !== role ||
    payload.extraData !== ""
  ) {
    res.end("JWT verification failed.");
    return;
  }

  // Ping google drive to share the file using the refresh token
  // Get latest refresh token
  const query = {
    text:
      "select sharers.latest_refresh_token as token, links.drive_id as drive_id from links left join sharers on links.sharer_id = sharers.id WHERE links.id = $1",
    values: [uuid],
  };

  let data = await runQuery(query);
  const refresh_token = data.token;
  const drive_id = data.drive_id;

  const oauth_client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST}/${googleRedirectUri}`
  );

  oauth_client.setCredentials({ refresh_token });
  const roles = ["reader", "commenter", "writer"];

  const permission = {
    type: "user",
    role: roles[role],
    emailAddress: requested_email,
  };
  const drive = google.drive({
    version: "v3",
    auth: oauth_client,
  });

  await drive.permissions.create({
    resource: permission,
    fileId: drive_id,
    fields: "id",
  });

  // Send drive ID back and redirect
  res.end(drive_id);
});

fastify.get("/api/oauth/google/callback", async (request, response) => {
  response.redirect(process.env.LIT_PROTOCOL_OAUTH_FRONTEND_HOST);
});

// BEGIN ZOOM STUFF

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

  const data = await zoom.getAccessToken({ code: request.query.code });
  const accessToken = data.access_token;

  const user = await zoom.getUser({ accessToken });
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

  reply.redirect(process.env.LIT_PROTOCOL_OAUTH_FRONTEND_HOST);
});

fastify.post("/api/zoom/meetingsAndWebinars", async (request, reply) => {
  const { authSig } = request.body;

  if (!authUser(authSig)) {
    reply.code(400);
    return { error: "Invalid signature" };
  }
  const userId = authSig.address;

  let services = (
    await fastify.pg.query(
      "SELECT * FROM connected_services WHERE user_id=$1 and service_name=$2",
      [userId, "zoom"]
    )
  ).rows;

  // add shares
  services = await Promise.all(
    services.map(async (service) => {
      const shares = (
        await fastify.pg.query(
          "SELECT * FROM shares WHERE connected_service_id=$1",
          [service.id]
        )
      ).rows;
      // console.log("got shares", shares);
      return { ...service, shares };
    })
  );

  const meetingsAndWebinars = (
    await Promise.all(
      services.map((s) =>
        zoom.getMeetingsAndWebinars({
          accessToken: s.access_token,
          refreshToken: s.refresh_token,
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
      share.accessControlConditions = JSON.parse(share.accessControlConditions);
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
  const { joinUrl } = await zoom.createMeetingInvite({
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

fastify.post("/api/connectedServices", async (request, reply) => {
  const { authSig } = request.body;

  if (!authUser(authSig)) {
    reply.code(400);
    return { error: "Invalid signature" };
  }
  const userId = authSig.address;

  const services = (
    await fastify.pg.query(
      "SELECT service_name, email, created_at FROM connected_services WHERE user_id=$1",
      [userId]
    )
  ).rows;

  return {
    services: services.map((s) => keysToCamel(s)),
  };
});

fastify.listen(process.env.PORT || 3000, "0.0.0.0", (err) => {
  if (err) throw err;
  console.log(`server listening on ${fastify.server.address().port}`);
});
