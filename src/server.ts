import express from "express";
import { createGoogleOAuthClient, getPort, handleTokenUpdate } from "./lib";
import { Server } from "http";

export async function startServer() {
  let server: Server | null = null;
  const app = express();
  const { authUrl } = await createGoogleOAuthClient();
  const port = await getPort();
  console.log(`Starting server...`);
  console.log(`Detected Port ${port}`);
  console.log(`Open the url: ${authUrl}`);
  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    const { client } = await createGoogleOAuthClient();
    const result = await client.getToken(code as string);
    await handleTokenUpdate(result.tokens);
    console.log(`Tokens Saved`);
    res.send("Ok");
    console.log(`Stopping server...`);
    if (server) {
      server.close();
    }
  });
  server = app.listen(port, () => {
    console.log(`Server started on port ${port}`);
  });
  return server;
}
