const { Feed } = require("feed");
const config = require("../config/index");

const convertEntriesToRss = (blogName, entries)=>{
  const blog = config[blogName];
  const feed = new Feed({
    title: blogName,
    description: blogName,
    id: blogName,
    link: `http://${blogName}.link`,
    language: "en",
    updated: new Date(),
    generator: "nodejs", 
    // feedLinks: {},
    author: {
      name: "Rakesh Bade",
      email: "rakeshbade@gmail.com",
      link: "baderakesh.com"
    }
  });
  (entries || []).forEach((post)=>{
    feed.addItem({
      title: post.title,
      id: post.url,
      link: post.url,
      description: post.description || post.title,
      content: post.content || post.description || post.title,
      date: new Date(post.date) || Date.now(),
    });
  })
  return feed.rss2()
}

module.exports = {
  convertEntriesToRss
}