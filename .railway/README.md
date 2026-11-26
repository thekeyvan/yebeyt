# Railway

`railway.ts` describes the `yebeyt` Railway project: the `server` service (built from `apps/server/Dockerfile`, deployed from `main`, health check `/health`, domain api.yebeyt.com), its Postgres, and the `web` service (the website, built from `apps/web/Dockerfile`, deployed from `main`, health check `/`, domains yebeyt.com and www.yebeyt.com) and the `webapp` service (the web app, built from `apps/webapp/Dockerfile`, deployed from `main`, health check `/`, domain app.yebeyt.com). Environment variables are not managed here (`variables: { managed: false }`); they live only in Railway.

The file imports `railway/iac`, a root devDependency (`pnpm install`). From the repo root, after `railway link`:

- `railway config plan` previews what would change in Railway.
- `railway config apply` applies it after confirmation.
