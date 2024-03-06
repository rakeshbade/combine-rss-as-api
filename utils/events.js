const EventEmitter = require("node:events");
const { fetchData, fetchEntries } = require("../services/fetch");
const blogs = require("./../config/index");
const { writeToFile } = require("./fileUtils");
const { convertEntriesToRss, appCache, getDateTimeET } = require("./feed");

const eventEmitter = new EventEmitter();
eventEmitter.on("fetchData", (blogName) => {
  eventEmitter.removeListener("fetchData", () => {});
  fetchData(blogName);
});

eventEmitter.on("fetchAllFeed", async (feedName) => {
  eventEmitter.removeListener("fetchAllFeed", () => {});
  const blogNames = Object.keys(blogs);
  let completeData = [];
  for (let i = 0; i < blogNames.length; i++) {
    const blog = blogNames[i];
    console.log("Fetching data for ", blog);
    const data = await fetchEntries(blog);
    console.log("data", data);
    completeData = [...data, ...completeData];
  }

  let rssXml = convertEntriesToRss(feedName, completeData);
  writeToFile(feedName, rssXml);
});

module.exports = { eventEmitter };
