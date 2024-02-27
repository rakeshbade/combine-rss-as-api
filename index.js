const express = require("express");
const app = express();
const { fetchData } = require("./services/fetch");
const { getDataFromFile } = require("./utils/fileUtils");
const port = process.env.PORT || 3000; // You can choose any port number
const { applicationLogger: LOG, eventLogger } = require("./services/logger");
const { zipAllFiles } = require("./services/download");
const { getEarningsCalendar } = require("./services/earnings");

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

app.get("/sec-earnings", async(req,res)=>{
  try {
    const numberOfWeeks = 2;
    LOG.info(`Get earning calendar for the next ${numberOfWeeks} weeks`);
    const data = await getEarningsCalendar({numberOfWeeks})
    res.send(data);
  } catch (e) {
    LOG.error(e);
    return res.status(500).send(e);
  }
})

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

app.get("/download",  async (req, res) => {
  const archive = zipAllFiles();
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', 'attachment; filename=all_files.zip');
  archive.pipe(res);
})

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
