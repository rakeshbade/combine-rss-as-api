const express = require('express');
const app = express();
const {fetchData, convertEntriesToRss} = require("./controllers/fetch")
const port = process.env.PORT || 3000; // You can choose any port number


app.get('/', async (req, res) => {
  const {blog, jsLoad} = req.query;
  if(!blog) return res.status(404).send({message:"invalid query"});
  try{
    const entries = await fetchData(blog, jsLoad);
    const xmlFeedWithEntries = convertEntriesToRss(blog, entries);
    return res.send(xmlFeedWithEntries);
  }catch(e){
    return res.status(500).send(e);
  }

});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
