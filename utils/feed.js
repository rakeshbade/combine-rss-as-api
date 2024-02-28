const { Feed } = require("feed");
const config = require("../config/index");

const convertEntriesToRss = (blogName, entries = [])=>{
  const blog = config[blogName];
  const sortedList = entries.slice().sort((a, b) => {
    return b.date - a.date; 
  });
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
  sortedList.forEach((post)=>{
    const title = post.title;
    const description =  post.description || post.title;
    const link = post.url || post.link;
    feed.addItem({
      title: title,
      id: link,
      link: link,
      description: description,
      content: description,
      date: new Date(post.date) || Date.now(),
    });
  })
  return feed.rss2()
}

module.exports = {
  convertEntriesToRss
}