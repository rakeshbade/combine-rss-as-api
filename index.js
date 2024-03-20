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
const {
  getEarningsCalendar,
  getCompanyCodesFromEarningsData,
  getRecentSecFilingsForEarnings,
} = require("./services/earnings");
const { eventEmitter } = require("./utils/events");
const { appCache, convertEntriesToRss } = require("./utils/feed");
const { getAnalystRatings } = require("./services/ratings");

process.env.TZ = "America/New_York";

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
    let xmlFeed = await getDataFromRssData(name);
    const { cache } = req.query;
    if (cache === "false") {
      appCache.clearCurrentData();
    }
    eventEmitter.emit("fetchAllFeed", name);
    return res.set("Content-Type", "text/xml").send(xmlFeed);
  } catch (e) {
    LOG.error(e);
    return res.status(500).send(e);
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
    const rssXml = convertEntriesToRss("sec-listings", secFillings);
    LOG.info("XML RSS lisings", rssXml);
    return res.set("Content-Type", "text/xml").send(rssXml);
  } catch (e) {
    LOG.error(e);
    let error = typeof e === "object" ? JSON.stringify(e) : e;
    return res.status(500).send({ error });
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

app.get("/download", async (req, res) => {
  const archive = zipAllFiles();
  res.set("Content-Type", "application/zip");
  res.set("Content-Disposition", "attachment; filename=all_files.zip");
  archive.pipe(res);
});

// Start the server
app.listen(port, async () => {

  // for testing
  console.log(`Server listening on port ${port} `);

    // expose outside
  //   const subdomain = ip.address() ? `rbade-` + ip.address().replaceAll(".","-") : null;
  //   const tunnel = await localtunnel({ port, subdomain, "bypass-tunnel-reminder": true });
  //   const localUrl = await tunnelmole({port})
  // console.log(
  //   `
  //     Extenal: ${tunnel.url}
  //     Test: ${localUrl}
  //  `);
});
