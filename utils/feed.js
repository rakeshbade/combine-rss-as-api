const { Feed } = require("feed");
const { isWithInHours } = require("./../services/utils");
const { postLogger: LOG } = require("./../services/logger");
const { default: axios } = require("axios");
const xml2js = require("xml2js");
const parser = new xml2js.Parser();

// const buildCache = () => {
//   const cache = new NodeCache({ stdTTL: 60000, checkperiod: 60000 });
//   const lastLoadedData = "lastLoadedData";
//   return {
//     getCurrentData: () => {
//       return cache.get(lastLoadedData);
//     },
//     setCurrentData: (value) => {
//       return cache.set(lastLoadedData, value);
//     },
//     clearCurrentData: () => {
//       return cache.del(lastLoadedData);
//     },
//     hasChangedData: (currentData, newData)=>{
//       console.log("current", currentData.length, "newData", newData.length)
//     }
//   };
// };

const buildCache = () => {
  let lastLoadedData;
  return {
    getCurrentData: async () => {
      const { data } = await axios.get("https://65fb597614650eb21009d993.mockapi.io/api/v1/current/posts/1");
      lastLoadedData = data?.data || null;
      return lastLoadedData;
    },
    setCurrentData: async (value) => {
      await axios.put("https://65fb597614650eb21009d993.mockapi.io/api/v1/current/posts/1", {data: value});
      lastLoadedData = value
      return lastLoadedData;
    },
    clearCurrentData: async () => {
      await axios.put("https://65fb597614650eb21009d993.mockapi.io/api/v1/current/posts/1", {data: null});
      lastLoadedData = null;
      return lastLoadedData;
    },
    hasChangedData: async (newData)=>{
      if(!newData?.length || !lastLoadedData.length) return true;
      //filter old post
      const filterData = (lastLoadedData || []).filter(post=> isWithInHours(post.date,1));
      if(!filterData.length) return newData;
      return newData.filter((post)=>{
        let notFound = true;
        for(i=0; i<filterData.length;i++){
          const urlParams = new URL(post.link);
          if(filterData[i].link.includes(urlParams.pathname) && filterData[i].link.includes(urlParams.hostname)){
            LOG.info(post);
            notFound = false;
            break;
          }
        }
        return notFound
      })
    }
  };
};

const getDateTimeET = (post) => {
  if (!post) return;
  let result;
  const timeZone = "America/Chicago";
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

const convertFeedToJson = (feed)=>{
  return new Promise((resolve, reject)=>{
    parser.parseString(feed, (err, result)=>{
      if(err) return reject(err);
      const entries =
        result?.["rss"]?.["channel"]?.[0]?.["item"]  || result?.urlset?.url;
        const jsonObj = JSON.stringify(entries);
        const replaceNews = jsonObj.replace(/news:/g,"");
        const parseNews = JSON.parse(replaceNews)
        let list = parseNews.map((e)=>{
          const objEntrires = Object.entries(e?.news?.[0] || {});
          if(!objEntrires.length > 1) return;
          if(e.lastmod){
            objEntrires.push(["lastmod", e.lastmod])
          }
          if(e.loc){
            objEntrires.push(["link", e.loc])
          }
          return objEntrires.reduce((prev, [key,value])=>{
            return {
              ...prev,
              [key]: value[0]
            } 
          },{})
          
        }).filter(Boolean)
        return resolve(list)
    })
  })
}

module.exports = {
  convertEntriesToRss,
  appCache: buildCache(),
  getDateTimeET,
  convertFeedToJson
};
