import Fastify from "fastify";
import fastifyPostgres from "fastify-postgres";
import fastifyCors from "fastify-cors";
import fastifyStatic from "fastify-static";
import * as path from "path";
import axios from "axios";

import { authUser } from "./auth.js";

const __dirname = path.resolve();

// import Bugsnag from "@bugsnag/js";
// Bugsnag.start({
//   apiKey: "f1e11c9bf8115a600106376040bc50cc",
//   releaseStage: process.env.LIT_GATEWAY_ENVIRONMENT,
// });

const fastify = Fastify();

const dbConfig = {
  connectionString: process.env.LIT_PROTOCOL_OAUTH_ZOOM_DB_URL,
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

  let url =
    "https://zoom.us/oauth/token?grant_type=authorization_code&code=" +
    request.query.code +
    "&redirect_uri=" +
    process.env.LIT_PROTOCOL_OAUTH_ZOOM_REDIRECT_URL;

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
  const accessToken = resp.data.access_token;
  const user = await axios.get("https://api.zoom.us/v2/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  console.log("user", user.data);

  reply.redirect(process.env.LIT_PROTOCOL_OAUTH_FRONTEND_HOST);
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
      "SELECT * FROM connected_services WHERE user_id=$1",
      [userId]
    )
  ).rows;

  return {
    services: services.map((s) =>
      JSON.stringify({
        serviceName: s.service_name,
      })
    ),
  };
});

fastify.listen(process.env.PORT || 4000, "0.0.0.0", (err) => {
  if (err) throw err;
  console.log(`server listening on ${fastify.server.address().port}`);
});
