const EventEmitter = require("node:events");
const { fetchData, fetchEntries } = require("../services/fetch");
const blogs = require("./../config/index");
const { writeToFile } = require("./fileUtils");
const { convertEntriesToRss, appCache } = require("./feed");
const { applicationLogger: LOG } = require("./../services/logger");
const { getRecentSecFilingsForEarnings } = require("../services/earnings");

const eventEmitter = new EventEmitter();
eventEmitter.on("fetchData", (params) => {
  eventEmitter.removeListener("fetchData", () => { });
  const blogName = typeof params === 'string' ? params : params.blog;
  const enableAI = typeof params === 'string' ? false : params.enableAI || false;
  fetchData(blogName, enableAI);
});

eventEmitter.on("fetchAllFeed", async (params) => {
  eventEmitter.removeListener("fetchAllFeed", () => { });
  try {
    const feedName = typeof params === 'string' ? params : params.name;
    const exclude = typeof params === 'string' ? '' : params.exclude || '';
    const enableAI = typeof params === 'string' ? false : params.enableAI || false;
    const excludeList = exclude ? exclude.split(',').map(item => item.trim()) : [];
    const blogNames = Object.keys(blogs).filter(name => !excludeList.includes(name));
    let completeData = [];
    for (let i = 0; i < blogNames.length; i++) {
      const blog = blogNames[i];
      const data = await fetchEntries(blog, enableAI);

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
    eventEmitter.emit("fetchAllFeedComplete");
  } catch (err) {
    LOG.error(err)
    eventEmitter.emit("fetchAllFeedComplete");
  }
});

eventEmitter.on("secEarnings",async (feedName)=>{
  const secFillings = await getRecentSecFilingsForEarnings();
  LOG.info("secFillings", secFillings);
  const rssXml = convertEntriesToRss("sec-listings", secFillings);
  writeToFile(feedName, rssXml);
})

module.exports = { eventEmitter };
