import dotenv from "dotenv";
dotenv.config();
import logger from "./config/logger";

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index";
import { limiter } from "./middlewares/rateLimiter.middleware";
import { proxyServices } from "./config/services";


const app = express();

app.use(helmet());
app.use(cors());
app.use(limiter);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});


proxyServices(app);

app.use((req: Request, res: Response) => {
  logger.warn(`Resource not found: ${req.method} ${req.url}`);
  res.status(404).json({ message: "resource not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const startServer = () => {
  try {
    app.listen(config.PORT, () => {
      logger.info(`${config.SERVICE_NAME} running on port ${config.PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
