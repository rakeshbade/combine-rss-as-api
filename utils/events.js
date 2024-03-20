const EventEmitter = require("node:events");
const { fetchData, fetchEntries } = require("../services/fetch");
const blogs = require("./../config/index");
const { writeToFile } = require("./fileUtils");
const { convertEntriesToRss, appCache } = require("./feed");
const { applicationLogger: LOG } = require("./../services/logger");

const eventEmitter = new EventEmitter();
eventEmitter.on("fetchData", (blogName) => {
  eventEmitter.removeListener("fetchData", () => { });
  fetchData(blogName);
});

eventEmitter.on("fetchAllFeed", async (feedName) => {
  eventEmitter.removeListener("fetchAllFeed", () => { });
  try {
    const blogNames = Object.keys(blogs);
    let completeData = [];
    for (let i = 0; i < blogNames.length; i++) {
      const blog = blogNames[i];
      const data = await fetchEntries(blog);

      completeData = [...data, ...completeData];
    }
    const currentData = await appCache.getCurrentData();
    if (!currentData) {
      await appCache.setCurrentData(completeData);
    }
    else {
      const changedData = await appCache.hasChangedData(completeData);
      if (changedData.length) {
        await appCache.setCurrentData(completeData);
        completeData = changedData;
      } else {
        completeData = [];
      }
    }
    let rssXml = convertEntriesToRss(feedName, completeData);
    writeToFile(feedName, rssXml);
  } catch (err) {
    LOG.error(err)
  }
});

module.exports = { eventEmitter };
