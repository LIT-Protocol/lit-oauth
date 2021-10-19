import { google } from "googleapis";
import LitJsSdk from "lit-js-sdk";

export default async function (fastify, opts) {
  const googleRedirectUri = "api/oauth/google/callback";

  async function runQuery(query, subfield) {
    await fastify.pg.transact(async (client) => {
      const id = await client.query(query.text, query.values)
      return id;
    })
  }

  fastify.post("/api/google/share", async (req, res) => {
    // First - get Google Drive refresh token (given acct email and drive)
    const oauth_client = new google.auth.OAuth2(
      process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      "postmessage"
    );
    const { tokens } = await oauth_client.getToken(req.body.token);
    oauth_client.setCredentials(tokens);
    let refresh_token = "";
    if (tokens.refresh_token) {
      refresh_token = tokens.refresh_token;
    };
    // Now, get email + save information
    const drive = google.drive({
      version: "v3",
      auth: oauth_client,
    });
    const about_info = await drive.about.get({
      fields: "user",
    });

    let id = "";
    // Write to DB
    if (refresh_token !== "") {
      const query = {
        text: "INSERT INTO sharers(email, latest_refresh_token) VALUES($1, $2) RETURNING *",
        // TODO: text: "INSERT INTO sharers(email, latest_refresh_token) VALUES($1, $2) ON CONFLICT (email) DO UPDATE SET latest_refresh_token = $2 RETURNING *",
        values: [about_info.data.user.emailAddress, refresh_token],
      };
      id = await runQuery(query, "id");

    } else {
      const query = {
        text: "SELECT id FROM sharers WHERE email = $1",
        values: [about_info.data.user.emailAddress],
      };

      id = await runQuery(query, "id");
    }
    const query = {
      text: "INSERT INTO links(drive_id, requirements, sharer_id, role) VALUES($1, $2, $3, $4) RETURNING *",
      values: [
        req.body.driveId,
        JSON.stringify(req.body.accessControlConditions),
        id,
        req.body.role,
      ],
    };
    let uuid = await runQuery(query, "id");

    console.log('STRINGIFY', JSON.stringify({
      authorizedControlConditions: req.body.accessControlConditions,
      uuid: uuid,
    }))

    res.send(
      JSON.stringify({
        authorizedControlConditions: req.body.accessControlConditions,
        uuid: uuid,
      })
    );
  });

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
    const query = {
      text: "SELECT requirements, role FROM links WHERE id = $1",
      values: [uuid],
    };

    let data = await runQuery(query);
    res.send(JSON.stringify(data));
  });

  fastify.post("/api/google/shareLink", async (req, res) => {
    // Check the supplied JWT
    const requested_email = req.body.email;
    const role = req.body.role.toString();
    const uuid = req.body.uuid;
    const jwt = req.body.jwt;
    const { verified, header, payload } = LitJsSdk.verifyJwt({ jwt });
    if (
      !verified ||
      payload.baseUrl !==
      `${process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST}/${googleRedirectUri}` ||
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
      text: "select sharers.latest_refresh_token as token, links.drive_id as drive_id from links left join sharers on links.sharer_id = sharers.id WHERE links.id = $1",
      values: [uuid],
    };

    let data = await runQuery(query);
    const refresh_token = data.token;
    const drive_id = data.drive_id;

    const oauth_client = new google.auth.OAuth2(
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      process.env.LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_SECRET,
      "postmessage"
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
    res.send(drive_id);
  });

  fastify.get("/api/oauth/google/callback", async (request, response) => {
    console.log("/api/oauth/google/callback query params", request.query);
    response.redirect(process.env.LIT_PROTOCOL_OAUTH_FRONTEND_HOST);
  });
}
