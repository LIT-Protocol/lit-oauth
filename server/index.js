import Fastify from "fastify";
import fastifyPostgres from "fastify-postgres";
import fastifyCors from "fastify-cors";
import fastifyStatic from "fastify-static";
import * as path from "path";
import zoomOauthEndpoints from "./oauth/zoom.js";
import googleOauthEndpoints from "./oauth/google.js";

import { authUser } from "./auth.js";
import { keysToCamel } from "./utils.js";
// import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
// import { google } from "googleapis";
import Bugsnag from "@bugsnag/js";
// import pkg from "pg";


dotenv.config({
  path: "../.env",
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

fastify.listen(process.env.PORT || 4000, "0.0.0.0", (err) => {
  if (err) throw err;
  console.log(`server listening on ${fastify.server.address().port}`);
});
