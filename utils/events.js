const EventEmitter = require('node:events');
const { fetchData, fetchEntries } = require('../services/fetch');
const blogs = require("./../config/index");
const { writeToFile } = require('./fileUtils');
const { convertEntriesToRss, appCache, getDateTimeET } = require('./feed');

const eventEmitter = new EventEmitter();
eventEmitter.on('fetchData', (blogName)=>{
  eventEmitter.removeListener('fetchData', ()=>{});
  fetchData(blogName)
});

eventEmitter.on('fetchAllFeed', async (feedName)=>{
    eventEmitter.removeListener('fetchAllFeed', ()=>{});
    const blogNames = Object.keys(blogs);
    let completeData = [];
    for(let i=0; i < blogNames.length; i++){
      const blog = blogNames[i];
      const data = await fetchEntries(blog);
      completeData = [...data, ...completeData];
    }

    let rssXml = convertEntriesToRss(feedName, completeData);
    if(appCache.hasChangedData(rssXml)){
      appCache.setCurrentData(rssXml);
    }else{
      rssXml = convertEntriesToRss(feedName, []);
    }
    writeToFile(feedName, rssXml);
});


module.exports = {eventEmitter}