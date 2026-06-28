import { createApp } from "./create-app";

(async () => {
  const app = await createApp();

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
})();