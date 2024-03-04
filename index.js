const express = require("express");
const app = express();
const { fetchData, fetchEntries } = require("./services/fetch");
const { getDataFromRssData } = require("./utils/fileUtils");
const port = process.env.PORT || 9981; // You can choose any port number
const { applicationLogger: LOG, eventLogger } = require("./services/logger");
const { zipAllFiles } = require("./services/download");
const { getEarningsCalendar, getCompanyCodesFromEarningsData, getRecentSecFilingsForEarnings } = require("./services/earnings");
const { eventEmitter } = require("./utils/events");
const {appCache, convertEntriesToRss} = require("./utils/feed")

process.env.TZ = "America/New_York"

app.get("/rss", async (req, res) => {
  const { blog } = req.query;
  if (!blog) return res.status(404).send({ message: "invalid query" });
  try {
    LOG.info("Received request for", blog);

    let xmlFeed = await getDataFromRssData(blog);
    if (!xmlFeed) {
      await fetchData(blog);
      xmlFeed = await getDataFromRssData(blog);
    } else {
      eventEmitter.emit("fetchData", blog);
    }
    return res.set("Content-Type", "text/xml").send(xmlFeed);
  } catch (e) {
    LOG.error(e);
    return res.status(500).send(e);
  }
});

app.get("/feed-all", async (req, res) => {
  try {
    let name = "all";
    const { cache } = req.query;
    if(cache === "false"){
      appCache.clearCurrentDate();
    }else{
      appCache.setCurrentDate();
    }
    eventEmitter.emit("fetchAllFeed", name);
    let xmlFeed = await getDataFromRssData(name);
    return res.set("Content-Type", "text/xml").send(xmlFeed);
  } catch (e) {
    LOG.error(e);
    return res.status(500).send(e);
  }
});

app.get("/sec-earnings", async(req,res)=>{
  try {
    const numberOfWeeks = 2;
    const earnings = await getEarningsCalendar({numberOfWeeks});
    const companies = getCompanyCodesFromEarningsData(earnings);
    const secFillings = await getRecentSecFilingsForEarnings(companies);
    const rssXml = convertEntriesToRss("sec-listings", secFillings);
    return res.set("Content-Type", "text/xml").send(rssXml);
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
