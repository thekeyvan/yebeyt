import { defineRailway, postgres, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const PostgresExvV = postgres("Postgres-ExvV", { region: "europe-west4-drams3a" });
  PostgresExvV.deploy = { multiRegionConfig: { "europe-west4-drams3a": { numReplicas: 1 } } };
  PostgresExvV.networking = { privateNetworkEndpoint: "postgres-exvv" };
  const postgresVolume1kOn = volume("postgres-volume-1kOn", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "europe-west4-drams3a", sizeMB: 5000 });
  const server = service("server", {
    source: { repo: "thekeyvan/yebeyt", branch: "main" },
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/server/Dockerfile", watchPatterns: ["apps/server/**", "packages/**", "pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"] },
    healthcheckPath: "/health",
    healthcheckTimeout: 60,
    replicas: { "europe-west4-drams3a": 1 },
    domains: ["api.yebeyt.com"],
  });

  return project("yebeyt", {
    variables: { managed: false },
    resources: [PostgresExvV, server, postgresVolume1kOn],
  });
});
