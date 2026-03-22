import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import devLoginHandler from "../../api/dev-login";

function createHandlerApp(
  path: string,
  handler: (req: express.Request, res: express.Response) => Promise<void> | void
) {
  const app = express();
  app.use(express.json());
  app.all(path, (req, res) => {
    void handler(req, res);
  });
  return app;
}

describe("dev-login route", () => {
  const snapshot = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_E2E_DEV_LOGIN: process.env.ALLOW_E2E_DEV_LOGIN,
  };

  afterEach(() => {
    process.env.NODE_ENV = snapshot.NODE_ENV;
    if (snapshot.ALLOW_E2E_DEV_LOGIN === undefined) {
      delete process.env.ALLOW_E2E_DEV_LOGIN;
    } else {
      process.env.ALLOW_E2E_DEV_LOGIN = snapshot.ALLOW_E2E_DEV_LOGIN;
    }
  });

  it("returns 404 in production when ALLOW_E2E_DEV_LOGIN is not set", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_E2E_DEV_LOGIN;

    const app = createHandlerApp("/api/dev-login", devLoginHandler as never);
    const response = await request(app).post("/api/dev-login");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });

  it("returns 404 Not configured in production when CI flag is set but E2E creds are missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_E2E_DEV_LOGIN = "1";
    delete process.env.E2E_AUTH_EMAIL;
    delete process.env.E2E_AUTH_PASSWORD;

    const app = createHandlerApp("/api/dev-login", devLoginHandler as never);
    const response = await request(app).post("/api/dev-login");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not configured" });
  });
});
