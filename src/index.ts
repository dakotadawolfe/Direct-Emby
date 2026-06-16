import { createApp } from "./app";
import { loadRuntimeConfig } from "./config";

const config = loadRuntimeConfig();
const app = createApp({ config });

app.listen(config.port, () => {
  process.stdout.write(`DirectEmby listening on port ${config.port}\n`);
});
