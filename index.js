const express = require("express");
const app = express();
const { fetchData } = require("./controllers/fetch");
const { getDataFromFile } = require("./utils/fileUtils");
const port = process.env.PORT || 3000; // You can choose any port number
const { applicationLogger: LOG, eventLogger } = require("./controllers/logger");

app.get("/rss", async (req, res) => {
  const { blog } = req.query;
  if (!blog) return res.status(404).send({ message: "invalid query" });
  try {
    LOG.info("Received request for", blog);

    let xmlFeed = await getDataFromFile(blog);
    if (!xmlFeed) {
      await fetchData(blog);
      xmlFeed = await getDataFromFile(blog);
    } else {
      fetchData(blog);
    }
    return res.set("Content-Type", "text/xml").send(xmlFeed);
  } catch (e) {
    LOG.error(e);
    return res.status(500).send(e);
  }
});

app.post("/log", express.json({ type: ["text/*"] }), (req, res) => {
  const { type } = req.params;
  if (!req.body) {
    return res.status(400).send(`Invalid body: ${req.body}`);
  }
  try {
    if (!type) {
      eventLogger.info(req.body);
    } else {
      eventLogger[type](req.body);
    }
    return res.status(200);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
