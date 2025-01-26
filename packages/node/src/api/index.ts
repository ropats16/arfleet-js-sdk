// @ts-ignore
import { defaultNodeConfig as config } from "../config.js";
import express from "express";
import type { Request, Response } from "express";

const MODE = process.env.MODE as string;
const apiServerConfig = config[MODE].apiServer;

export const startApi = async () => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const host = apiServerConfig.host;
  const port = (process.env.API_PORT as string) || apiServerConfig.port;

  if (MODE === "client") {
    // @ts-ignore
    const { apiStore } = await import("../client/apiStore.js");
    app.post("/store", apiStore);

    app.get("/api/assignments", async (req: Request, res: Response) => {
      // @ts-ignore
      const { default: getClientInstance } = await import("../client/index.js");
      const client = getClientInstance();
      const assignments = await client.getAssignments();
      res.send({ assignments: assignments });
    });

    app.get("/api/assignments/:id", async (req: Request, res: Response) => {
      // @ts-ignore
      const { default: getClientInstance } = await import("../client/index.js");
      const client = getClientInstance();
      const placements = await client.getAssignments(req.params.id);
      res.send({ placements: placements });
    });

    app.get("/api/placements/:id", async (req: Request, res: Response) => {
      // @ts-ignore
      const { default: getClientInstance } = await import("../client/index.js");
      const client = getClientInstance();
      const placement = await client.getPlacements(req.params.id);
      res.send({ placement: placement });
    });
  }

  if (MODE === "provider") {
    // Add provider specific routes here
  }

  app.get("/", (req: Request, res: Response) => {
    res.send("Hello from " + MODE + " API!");
  });

  app.listen(port, host, () => {
    console.log(`API app listening on http://${host}:${port}`);
  });
};
