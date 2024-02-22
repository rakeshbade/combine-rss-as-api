const fs = require("fs");

const getFileName = (blogName) => {
  return `./data/${blogName}.xml`;
};

const writeToFile = (blogName, data) => {
  const fileName = getFileName(blogName);
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const getDataFromFile = (blogName) => {
  const fileName = getFileName(blogName);
  if (!fs.existsSync(fileName)) {
    return null;
  }
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.toString());
      }
    });
  });
};

module.exports = { getFileName, writeToFile, getDataFromFile };
