import { client } from "./db/client";
import { createApp } from "./utils/create-app";

(async () => {
  const app = await createApp(client);

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
})();