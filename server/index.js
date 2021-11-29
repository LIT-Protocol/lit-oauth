import Fastify from "fastify";
import fastifyCors from "fastify-cors";
import fastifyStatic from "fastify-static";
import fastifyObjectionJS from "fastify-objectionjs";
import fastifyBugsnag from "lit-fastify-bugsnag";
import * as path from "path";
import zoomOauthEndpoints from "./oauth/zoom.js";
import googleOauthEndpoints from "./oauth/google.js";
import shopifyEndpoints from "./oauth/shopify.js";
import knexConfig from "./knexfile.js";

import { authUser } from "./auth.js";
import { keysToCamel } from "./utils.js";
import dotenv from "dotenv";
import Bugsnag from "@bugsnag/js";
import ConnectedServices from "./models/ConnectedServices.js";
import Shares from "./models/Shares.js";

dotenv.config({
  path: "../.env",
});

const __dirname = path.resolve();

// Bugsnag.start({
//   apiKey: "0596bd3230222ad050c4533cfa5c0393",
//   releaseStage: process.env.LIT_PROTOCOL_OAUTH_ENVIRONMENT,
// });

const fastify = Fastify();

fastify.register(fastifyCors, {
  origin: "*",
  methods: ["POST", "GET", "DELETE", "PUT", "PATCH"],
});

fastify.register(fastifyObjectionJS, {
  knexConfig: knexConfig[process.env.NODE_ENV || "development"],
  models: [ConnectedServices, Shares],
});

const BuildPath = path.join(__dirname, "..", "build");
fastify.register(fastifyStatic, {
  root: BuildPath,
});

// fastify.setErrorHandler((error, request, reply) => {
//   console.log("Fastify error: ", error);
//   if (process.env.LIT_GATEWAY_ENVIRONMENT !== "local") {
//     Bugsnag.notify(error);
//   }
//   reply.send({error});
// });

fastify.register(fastifyBugsnag, {
  apiKey: "0596bd3230222ad050c4533cfa5c0393",
  enableReporting: process.env.NODE_ENV === "production",
  releaseStage: process.env.LIT_PROTOCOL_OAUTH_ENVIRONMENT,
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

fastify.register(zoomOauthEndpoints);
fastify.register(googleOauthEndpoints);
fastify.register(shopifyEndpoints);

// http to https redirect
if (process.env.NODE_ENV === "production") {
  fastify.addHook("onRequest", async (request, reply) => {
    if (request.headers["x-forwarded-proto"]) {
      if (request.headers["x-forwarded-proto"] === "http") {
        return reply.redirect(
          `https://${request.headers.host}${request.raw.url}`
        );
      }
    }
  });
}

fastify.setNotFoundHandler((req, res) => {
  res.status(200);
  res.sendFile("index.html");
});

fastify.listen(process.env.PORT || 4000, "0.0.0.0", (err) => {
  if (err) throw err;
  console.log(`server listening on ${fastify.server.address().port}`);
});
