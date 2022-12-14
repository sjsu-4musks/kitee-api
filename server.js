const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const expressRequestId = require("express-request-id")();
const { PORT, MONGO_URL } = require("./src/utils/config");
const logger = require("./src/utils/logger");

const app = express();

app.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  next();
});

app.use(expressRequestId);

morgan.token("requestId", (request) => request.id);

app.use(
  morgan(":requestId :method :url :status :response-time ms", {
    stream: {
      write: (message) => logger.http(message),
    },
  })
);

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

app.use(express.json({ verify: rawBodySaver, limit: "50mb" }));
app.use(
  express.urlencoded({ verify: rawBodySaver, extended: true, limit: "50mb" })
);
app.use(express.raw({ verify: rawBodySaver, type: "*/*", limit: "50mb" }));

const whitelist = [
  "http://localhost:3000",
  "https://app.getkitee.com",
  "https://app-staging.getkitee.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin
      // (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (whitelist.indexOf(origin) === -1) {
        return callback(
          new Error(
            "The CORS policy for this site does not allow access from the specified Origin."
          ),
          false
        );
      }

      return callback(null, true);
    },
  })
);

// ROUTES
const userRoutes = require("./src/api/v1/users");
const formsRoutes = require("./src/api/v1/forms");
const responses = require("./src/api/v1/responses");
const insights = require("./src/api/v1/insights");

// USE ROUTES
app.use("/v1/users", userRoutes);
app.use("/v1/forms", formsRoutes);
app.use("/v1/responses", responses);
app.use("/v1/insights", insights);

app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Howdy!!!" });
});

const server = app.listen(PORT, () => {
  try {
    mongoose
      .connect(MONGO_URL)
      .then(() => logger.info("MongoDB Connected!!!"))
      .catch((err) => logger.error("MongoDB Connection Failed -> error ", err));

    logger.info(`App is now running on port ${PORT}!!!`);
  } catch (error) {
    logger.error("Failed to start server -> error : ", error);
  }
});

server.keepAliveTimeout = 65000; // Ensure all inactive connections are terminated by the ALB, by setting this a few seconds higher than the ALB idle timeout
server.headersTimeout = 66000; // Ensure the headersTimeout is set higher than the keepAliveTimeout due to this nodejs regression bug: https://github.com/nodejs/node/issues/27363
