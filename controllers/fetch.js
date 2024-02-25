const config = require("../config/index");
const { curly } = require("node-libcurl");
const axios = require("axios");
const xml2js = require("xml2js");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();
const { writeToFile } = require("../utils/fileUtils");
const { applicationLogger: LOG } = require("./logger");

const loadDataBy = {
  curl: "curl",
  puppeteer: "puppeteer",
  axios: "axios",
};

const parseFeed = (feed) => {
  return new Promise((resolve) => {
    parser.parseString(feed, (err, result) => {
      if (err || !result || !result["rss"] || !result["rss"]["channel"]) {
        return resolve(feed);
      }
      const entries = result["rss"]["channel"][0]["item"] || [];
      const simplifiedEntries = (entries || []).map((entry) => ({
        title: entry.title[0],
        pubDate: entry.pubDate[0],
        description: entry.description[0],
        link: entry.link[0],
      }));
      return resolve(simplifiedEntries);
    });
  });
};

const getArticlesFromPuppeter = (html, config) => {
  const articles = [];
  const $ = cheerio.load(html);
  $(config.container).each((i, ele) => {
    const article = {};
    article.title = $(ele).find(config.header).text().trim();
    article.link = $(ele).find(config.link).attr("href");
    article.date = $(ele).find(config.date).text().trim();
    if (article.date) {
      if (article.date.includes(" ago")) {
        article.date = article.date.replace(" ago", "");
      }
      if (article.date.includes(" ET")) {
        article.date = article.date.replace(" ET", "");
      }
      article.date = new Date(article.date).toISOString();
    } else {
      article.date = new Date().toISOString();
    }
    article.description = $(ele).find(config.description).text().trim();
    articles.push(article);
  });
  return articles;
};

const fetchArticlesFromPuppeter = async (url, config) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(
    "window.performance.timing.loadEventEnd - window.performance.timing.navigationStart >= 500",
  );
  await page.waitForSelector(config.container);
  const pageSourceHTML = await page.content();
  await browser.close();
  return getArticlesFromPuppeter(pageSourceHTML, config);
};

const waitFor = (timer) => {
  return new Promise((resolve) => {
    setTimeout(resolve, timer);
  });
};

const fetchData = async (blogName) => {
  const blogs = config[blogName];
  let currentLoadType = loadDataBy.axios;
  const fetchBlogData = async (rss) => {
    if (rss["loadType"]) {
      currentLoadType = rss["loadType"];
    }

    const url = rss["blogUrl"];
    LOG.info(
      "Fetching data for " +
        blogName +
        " from " +
        url +
        " using load type " +
        currentLoadType,
    );
    try {
      if (currentLoadType === loadDataBy.curl) {
        const { data } = await curly.get(url);
        return data.toString();
      } else if (currentLoadType === loadDataBy.puppeteer) {
        return await fetchArticlesFromPuppeter(url, rss);
      } else {
        const { data } = await axios.get(url);
        return data;
      }
    } catch (error) {
      LOG.error(error);
      return null;
    } finally {
      await waitFor(250);
    }
  };

  const blogPromises = blogs.map(fetchBlogData);

  const blogJsonData = await Promise.all(blogPromises);
  LOG.info("Blog data fetched for ", blogName, " successfully");
  const xmlToList = await Promise.all(
    blogJsonData.filter(Boolean).map(parseFeed),
  );
  LOG.info("Blog data parsed for ", blogName, " successfully");
  const entries = xmlToList.reduce(
    (accumulator, current) => accumulator.concat(current),
    [],
  );

  LOG.info(
    "Blog data merged for ",
    blogName,
    " successfully",
    "with entries",
    entries.length,
  );

  const rssXml = convertEntriesToRss(blogName, entries);
  await writeToFile(blogName, rssXml);

  LOG.info("Blog data written for ", blogName, " successfully");
};

const convertEntriesToRss = (blog, entries) => {
  const rssFeed = {
    rss: {
      channel: {
        title: blog,
        link: JSON.stringify(config[blog]),
        description: `feed for ${blog}`,
        item: entries,
      },
    },
  };
  const rssXml = builder.buildObject(rssFeed);
  return rssXml;
};

module.exports = { fetchData, convertEntriesToRss };
