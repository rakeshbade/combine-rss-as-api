const express = require("express");
const app = express();
const { fetchData } = require("./controllers/fetch");
const { getDataFromFile } = require("./utils/fileUtils");
const port = process.env.PORT || 3000; // You can choose any port number

app.get("/rss", async (req, res) => {
  const { blog } = req.query;
  if (!blog) return res.status(404).send({ message: "invalid query" });
  try {
    console.log("Received request for ", blog);

    let xmlFeed = await getDataFromFile(blog);
    if (!xmlFeed) {
      await fetchData(blog);
      xmlFeed = await getDataFromFile(blog);
    } else {
      fetchData(blog);
    }
    return res.set("Content-Type", "text/xml").send(xmlFeed);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
