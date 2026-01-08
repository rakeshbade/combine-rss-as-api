const express = require("express");
const app = express();
const ip = require('ip');
const localtunnel = require('localtunnel');
const tunnelmole = require('tunnelmole/cjs');
const { fetchData } = require("./services/fetch");
const { getDataFromRssData } = require("./utils/fileUtils");
const port = process.env.PORT || 3000; // You can choose any port number
const { applicationLogger: LOG } = require("./services/logger");
const { zipAllFiles } = require("./services/download");
const fs = require("fs")

const {
  getEarningsCalendar,
  getCompanyCodesFromEarningsData,
  getRecentSecFilingsForEarnings,
} = require("./services/earnings");
const { eventEmitter } = require("./utils/events");
const { appCache, convertEntriesToRss } = require("./utils/feed");
const { getAnalystRatings } = require("./services/ratings");
const { updateDate } = require("./services/market");

process.env.TZ = "America/New_York";

app.get("/rss", async (req, res) => {
  const { blog } = req.query;
  if (!blog) {
    const errorXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Error</title>
    <link>http://error.link</link>
    <description>Error: invalid query parameter</description>
  </channel>
</rss>`;
    return res.set("Content-Type", "text/xml; charset=utf-8").status(400).send(errorXml);
  }
  try {
    LOG.info("Received request for", blog);

    let xmlFeed = await getDataFromRssData(blog);
    if (!xmlFeed) {
      await fetchData(blog, req.query.aiFilter === 'true');
      xmlFeed = await getDataFromRssData(blog);
    } else {
      eventEmitter.emit("fetchData", { blog, enableAI: req.query.aiFilter === 'true' });
    }
    return res.set("Content-Type", "text/xml; charset=utf-8").send(xmlFeed);
  } catch (e) {
    LOG.error(e);
    // Return error as XML to prevent "not valid XML format" error from RSS readers
    const errorXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Error</title>
    <link>http://error.link</link>
    <description>Error fetching feed: ${e.message}</description>
  </channel>
</rss>`;
    return res.set("Content-Type", "text/xml; charset=utf-8").status(200).send(errorXml);
  }
});

app.get("/feed-all", async (req, res) => {
  try {
    let name = "all";
    const { exclude, aiFilter } = req.query;
    const forceReload = req.query.forceReload === 'true' ? true : false;
    
    if (forceReload) {
      // Fetch fresh data synchronously before returning
      await new Promise((resolve) => {
        eventEmitter.once("fetchAllFeedComplete", resolve);
        eventEmitter.emit("fetchAllFeed", { name, exclude, enableAI: aiFilter === 'true' });
      });
    } else {
      // Return cached data and fetch in background
      eventEmitter.emit("fetchAllFeed", { name, exclude, enableAI: aiFilter === 'true' });
    }
    
    let xmlFeed = await getDataFromRssData(name);
    return res.set("Content-Type", "text/xml; charset=utf-8").send(xmlFeed);
  } catch (e) {
    LOG.error(e);
    // Return error as XML to prevent "not valid XML format" error from RSS readers
    const errorXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Error</title>
    <link>http://error.link</link>
    <description>Error fetching feed: ${e.message}</description>
  </channel>
</rss>`;
    return res.set("Content-Type", "text/xml; charset=utf-8").status(200).send(errorXml);
  }
});

app.get("/sec-earnings", async (req, res) => {
  try {
    const { ignoreCompanies } = req.query;
    const numberOfWeeks = 2;
    const earnings = await getEarningsCalendar({ numberOfWeeks });
    const companies = getCompanyCodesFromEarningsData(earnings);
    const secFillings = await getRecentSecFilingsForEarnings(companies, ignoreCompanies);
    LOG.info("secFillings", secFillings);
    const rssXml = convertEntriesToRss("sec-earnings", secFillings);
    return res.set("Content-Type", "text/xml").send(rssXml);
  } catch (e) {
    LOG.error(e);
    // Return error as XML to prevent "not valid XML format" error from RSS readers
    const errorXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Error</title>
    <link>http://error.link</link>
    <description>Error fetching SEC earnings: ${e.message}</description>
  </channel>
</rss>`;
    return res.set("Content-Type", "text/xml; charset=utf-8").status(200).send(errorXml);
  }
});

app.get("/ratings", async (req, res)=>{
  try {
    const { ignoreCompanies } = req.query;
    const numberOfWeeks = 2;
    const earnings = await getEarningsCalendar({ numberOfWeeks });
    const companies = getCompanyCodesFromEarningsData(earnings);
    const ratings = await getAnalystRatings(companies, ignoreCompanies);
    const rssXml = convertEntriesToRss("sec-listings", ratings);
    LOG.info("XML RSS lisings", rssXml);
    return res.set("Content-Type", "text/xml").send(rssXml);
  }catch (e) {
    LOG.error(e);
    let error = typeof e === "object" ? JSON.stringify(e) : e;
    return res.status(500).send({ error });
  }
})

app.get("/gainers", async(req, res)=>{
  try{
    const gainersXml = fs.readFileSync("././data/gainers.xml");
    return res.set("Content-Type", "text/xml").send(gainersXml);
  }catch(error){
    console.log(error)
    return res.status(500).send({ error });
  }
})

app.get("/losers", async(req, res)=>{
  try{
    const losersXml = fs.readFileSync("././data/losers.xml");
    return res.set("Content-Type", "text/xml").send(losersXml);
  }catch(error){
    console.log(error)
    return res.status(500).send({ error });
  }
})

app.get("/update-market", async(req, res)=>{
  try{
    const forceReload = req.query.forceReload === 'true';
    const data = await updateDate(forceReload)
    return res.send(data);
  }catch(error){
    console.log(error)
    return res.status(500).send({ error });
  }
})

app.get("/download", async (req, res) => {
  const archive = zipAllFiles();
  res.set("Content-Type", "application/zip");
  res.set("Content-Disposition", "attachment; filename=all_files.zip");
  archive.pipe(res);
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

// Start the server
app.listen(port, async () => {

  // for testing
  console.log(`Server listening on port ${port} `);
});
