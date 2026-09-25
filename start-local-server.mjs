import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const taskclusterDir = path.resolve(
  process.argv[2] || path.join(here, "..", "targets", "taskcluster"),
);
const taskclusterPackage = JSON.parse(
  await readFile(path.join(taskclusterDir, "package.json"), "utf8"),
);
assert.equal(taskclusterPackage.name, "taskcluster");

const requireFromTaskcluster = createRequire(
  path.join(taskclusterDir, "package.json"),
);
const siftPackage = requireFromTaskcluster("sift/package.json");
assert.equal(
  siftPackage.version,
  "17.1.3",
  `Expected sift 17.1.3, found ${siftPackage.version}`,
);

const { default: load } = await import(
  pathToFileURL(path.join(taskclusterDir, "services/web-server/src/main.js"))
);

const emptyClient = {};
const clients = ({ credentials }) => {
  console.log(`HTTP credentials: ${credentials ? "present" : "none"}`);

  return {
    auth: {
      async expandScopes({ scopes }) {
        console.log(`Auth returned scopes: ${JSON.stringify(scopes)}`);
        return { scopes };
      },
    },
    github: emptyClient,
    hooks: emptyClient,
    index: emptyClient,
    purgeCache: emptyClient,
    queue: emptyClient,
    secrets: emptyClient,
    notify: emptyClient,
    workerManager: emptyClient,
  };
};

const monitor = {
  childMonitor() {
    return this;
  },
  exposeMetrics() {},
  reportError(error) {
    console.error(error);
  },
  log: {
    requestReceived() {},
  },
};

const port = Number(process.env.POC_PORT || 3211);
const cfg = {
  app: {
    publicUrl: `http://localhost:${port}`,
    playground: false,
    authorizationCodeExpirationDelay: "- 10 minutes",
  },
  server: {
    port,
    trustProxy: false,
    allowedCORSOrigins: [true],
    socketAliveTimeoutMilliSeconds: 21600000,
  },
  taskcluster: {
    rootUrl: "http://127.0.0.1",
    credentials: {},
    temporaryCredentials: {
      startOffset: "- 15 min",
      expiry: "3 days",
    },
  },
  login: {
    registeredClients: [],
    strategies: {},
    sessionSecret: "local-poc-only",
  },
};

const server = await load("httpServer", {
  cfg,
  monitor,
  clients,
  pulseEngine: null,
  strategies: {},
  auth: {},
  authFactory: () => ({
    currentScopes: async () => ({ scopes: [] }),
  }),
  db: {},
  api: null,
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Taskcluster web-server: http://127.0.0.1:${port}/graphql`);
});

const stop = () => {
  server.close(() => process.exit(0));
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
