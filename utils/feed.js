const { Feed } = require("feed");
const config = require("../config/index");

const getDateTimeET = (post)=>{
  let result;
  try{
    result = new Date(post.date).getTime()
  }catch(e){
    throw new Error("Invalid date in the post", post)
  }
  return new Date(result);
}

const convertEntriesToRss = (blogName, entries = [])=>{
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
      link: "baderakesh.com"
    }
  });
  sortedList.forEach((post)=>{
    const title = post.title;
    const description =  post.description || post.title;
    const link = post.url || post.link;
    let date = getDateTimeET(post)
    feed.addItem({
      title: title,
      id: link,
      link: link,
      description: description,
      content: description,
      date: date,
    });
  })
  return feed.rss2()
}

module.exports = {
  convertEntriesToRss
}