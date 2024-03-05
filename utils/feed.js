const { Feed } = require("feed");
const config = require("../config/index");
const NodeCache = require("node-cache");

const buildCache = () => {
  const cache = new NodeCache();
  const lastLoadedData = "lastLoadedData";
  const getBufferData = (value)=>{
    return Buffer.from(value).toString('base64')
  }
  return {
<<<<<<< HEAD
    getCurrentDate: () => {
      return cache.get(lastLoadedData);
    },
    setCurrentDate: () => {
      const value = Date.now();
      return cache.set(lastLoadedData, value);
    },
    clearCurrentDate: () => {
      return cache.del(lastLoadedData);
    },
    hasCurrentDate: () => {
      return cache.has(lastLoadedData);
    },
  };
};
=======
    getCurrentData: ()=>{
      return cache.get(lastLoadedData)
    },
    setCurrentData: (value)=>{
      const bufferData = getBufferData(value);
      return cache.set(lastLoadedData, bufferData);
    },
    clearCurrentData: ()=>{
      return cache.del(lastLoadedData);
    },
    hasChangedData: (value)=>{
      const bufferData = getBufferData(value);
      return bufferData !== cache.get(lastLoadedData);
    }
  }
}

>>>>>>> 243f67ff8788dcc574186851b32b6e26c5101a49

const getDateTimeET = (post) => {
  if (!post) return;
  let result;
  const timeZone = "America/New_York";
  try {
    let date = new Date(post.date);
    let utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    let tzDate = new Date(date.toLocaleString("en-US", { timeZone: timeZone }));
    let offset = utcDate.getTime() - tzDate.getTime();

    date.setTime(date.getTime() + offset);
    result = date;
  } catch (e) {
    throw Error("Invalid date in the post", post);
  }
  return new Date(result);
};

const convertEntriesToRss = (blogName, entries = []) => {
  const sortedList = entries.slice().sort((a, b) => {
    return b.date - a.date;
  });
  const feed = new Feed({
    title: blogName,
    description: blogName,
    id: blogName,
    link: `http://${blogName}.link`,
    language: "en",
    updated: getDateTimeET(sortedList[0]),
    generator: "nodejs",
    // feedLinks: {},
    author: {
      name: "Rakesh Bade",
      email: "rakeshbade@gmail.com",
      link: "baderakesh.com",
    },
  });
  sortedList.forEach((post) => {
    const title = post.title;
    const description = post.description || post.title;
    const link = post.url || post.link;
    let date = getDateTimeET(post);
    feed.addItem({
      title: title,
      id: link,
      link: link,
      description: description,
      content: description,
      date: date,
    });
  });
  return feed.rss2();
};

module.exports = {
  convertEntriesToRss,
  appCache: buildCache(),
  getDateTimeET,
};
