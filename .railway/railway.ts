import { defineRailway, postgres, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const PostgresExvV = postgres("Postgres-ExvV", { region: "europe-west4-drams3a" });
  PostgresExvV.deploy = { multiRegionConfig: { "europe-west4-drams3a": { numReplicas: 1 } } };
  PostgresExvV.networking = { privateNetworkEndpoint: "postgres-exvv" };
  const postgresVolume1kOn = volume("postgres-volume-1kOn", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "europe-west4-drams3a", sizeMB: 5000 });
  const server = service("server", {
    source: { repo: "thekeyvan/yebeyt", branch: "main" },
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/server/Dockerfile", watchPatterns: ["apps/server/**", "packages/**", "apps/ios/Yebeyt/Resources/Data/games.json", "apps/ios/Yebeyt/Resources/Data/library.json", "apps/ios/Yebeyt/Resources/Data/poets.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"] },
    healthcheckPath: "/health",
    healthcheckTimeout: 60,
    replicas: { "europe-west4-drams3a": 1 },
    domains: ["api.yebeyt.com"],
  });

  const web = service("web", {
    source: { repo: "thekeyvan/yebeyt", branch: "main" },
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/web/Dockerfile", watchPatterns: ["apps/web/**", "packages/tokens/**", "assets/fonts/**", "pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"] },
    healthcheckPath: "/",
    healthcheckTimeout: 60,
    replicas: { "europe-west4-drams3a": 1 },
    // www.yebeyt.com is sent to the apex by the app's own proxy (apps/web/proxy.ts).
    domains: ["yebeyt.com", "www.yebeyt.com"],
  });

  return project("yebeyt", {
    variables: { managed: false },
    resources: [PostgresExvV, server, web, postgresVolume1kOn],
  });
});
