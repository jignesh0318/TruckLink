import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>TruckLink API</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); max-width: 500px; width: 90%; border: 1px solid #334155; }
          h1 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
          p { color: #94a3b8; line-height: 1.6; }
          .btn { display: inline-block; background: #0284c7; color: #fff; padding: 0.75rem 1.25rem; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 1rem; transition: background 0.2s; }
          .btn:hover { background: #0369a1; }
          code { background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 4px; color: #38bdf8; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🚚 TruckLink API Server</h1>
          <p>The backend server is running and ready. API routes are accessible at <code>/api/*</code>.</p>
          <p>To access the main TruckLink user interface (Customer, Agency, and Driver workspaces), open the frontend app:</p>
          <a class="btn" href="http://localhost:5173">Open Web App (http://localhost:5173) &rarr;</a>
        </div>
      </body>
    </html>
  `);
});

export default app;
