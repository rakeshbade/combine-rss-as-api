const config = require("../config/index");
const blogRegex = require("../config/regex");
const { curly } = require("node-libcurl");
const axios = require("axios");
const xml2js = require("xml2js");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const parser = new xml2js.Parser();
const { writeToFile } = require("../utils/fileUtils");
const {convertEntriesToRss} = require("../utils/feed");
const { applicationLogger: LOG } = require("./logger");

const isPostByRegex = (post, blogName) => {
  const regex = blogRegex[blogName];
  if (!regex || JSON.stringify(post).match(regex)) return post;
};

const loadDataBy = {
  curl: "curl",
  puppeteer: "puppeteer",
  axios: "axios",
};

const getCurlHttpHeaders = url=>{
  const urlParams = new URL(url)
  return [
    `Host: ${urlParams.host}`,
    `Access-Control-Allowed-Origin: ${urlParams.host}`
  ]
}

const parseFeed = (feed) => {
  return new Promise((resolve) => {
    parser.parseString(feed, (err, result) => {
      if (err || !result || !result["rss"] || !result["rss"]["channel"]) {
        return resolve(feed);
      }
      const entries = result["rss"]["channel"][0]["item"] || [];
      const simplifiedEntries = (entries || []).reduce((prev, entry) => {
        const link = entry.link[0];
        if (!link) return prev;
        const date = new Date(String(entry.pubDate[0] || entry.date[0])).getTime() || Date.now();
        const description = entry.description[0] || entry.content[0] || entry.title[0];
        const title = entry.title[0];
        const post = {
          title: title.replace(/<\/?[^>]+(>|$)/g, ""),
          date,
          description: description.replace(/<\/?[^>]+(>|$)/g, ""),
          link,
        };
        prev.push(post);
        return prev;
      }, []);
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
  try{
    await page.goto(url);
    await page.waitForFunction(
      "window.performance.timing.loadEventEnd - window.performance.timing.navigationStart >= 500",
    );
    await page.waitForSelector(config.container);
    const pageSourceHTML = await page.content();
    return getArticlesFromPuppeter(pageSourceHTML, config);
  }catch(e){
    throw e
  }finally{
    await browser.close();
  }
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
        const { data } = await curly.get(url, {
          httpHeader: getCurlHttpHeaders(url),
        });
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
  const entries = xmlToList
    .reduce((accumulator, current) => accumulator.concat(current), [])
    .filter((post) => isPostByRegex(post, blogName));

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

module.exports = { fetchData, getCurlHttpHeaders };
