/* eslint-env node */
"use strict";
const beeline = require("honeycomb-beeline");

const HONEYCOMB_DATASET = process.env.HONEYCOMB_DATASET || "tracing-example";
const SERVICE_NAME = process.env.SERVICE_NAME || "wall";
const HONEYCOMB_API_KEY = process.env.HONEYCOMB_API_KEY || "abc123";

beeline({
  writeKey: HONEYCOMB_API_KEY,
  dataset: HONEYCOMB_DATASET,
  serviceName: SERVICE_NAME,
  httpTraceParserHook: beeline.w3c.httpTraceParserHook, // in case of mixed services
  httpTracePropagationHook: beeline.w3c.httpTracePropagationHook, // in case of mixed services
});

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const PORT = 3000;

const contents = ["first post"];

app.use(bodyParser.urlencoded({ extended: false, type: "*/*" }));

// = MIDDLEWARE ====================================================
// Wraps HTTP handlers to output evidence of HTTP calls + trace IDs
// to STDOUT for debugging.
// =================================================================
app.use((req, res, next) => {
  let traceContext = beeline.honeycomb.marshalTraceContext(beeline.getTraceContext());
  let { traceId } = beeline.honeycomb.unmarshalTraceContext(traceContext);
  console.log(
    "Handling request with:",
    JSON.stringify({
      method: req.method,
      path: req.path,
      traceId: traceId,
    })
  );

  next();
});

// = HANDLER =======================================================
// Returns the current contents of our "wall".
// =================================================================
app.get("/", (req, res) => {
  res.send(`${contents.join("<br />\n")}
    <br /><br /><a href="/message">+ New Post</a>`);
});

// = HANDLER =======================================================
// Returns a simple HTML form for posting a new message to our wall.
// =================================================================
app.get("/message", (req, res) => {
  res.send(`<form method="POST" action="/">
		<input type="text" autofocus name="message" /><input type="submit" />
	</form>`);
});

// = HANDLER =======================================================
// Processes a string from the client and saves the message contents.
// =================================================================
app.post("/", async (req, res) => {
  if (typeof req.body.message !== "string") {
    beeline.addTraceContext("error", "non-string body");
    res.status(500).send("not a string body");
    return;
  }

  const postSpan = beeline.startSpan({ name: "Posting a message" });
  let body = req.body.message.trim();

  contents.push(body);
  beeline.addTraceContext({ message: body });
  beeline.finishSpan(postSpan);

  res.redirect("/");
});

app.listen(PORT, () => console.log(`'wall' service listening on port ${PORT}}!`));
