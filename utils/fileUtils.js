const fs = require("fs");
const path = require("path")
const { applicationLogger: LOG } = require("./../services/logger");
const getFileName = (blogName) => {
  LOG.info(`Get file name from blog name ${blogName}`);
  return path.join(__dirname, `./../data/${blogName}.xml`);
};

const writeToFile = (blogName, data) => {
  LOG.info(`Write data to file from blogName ${blogName}`);
  const fileName = getFileName(blogName);
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, data, (err) => {
      if (err) {
        LOG.error(`Error: write data to file from blogName ${blogName}`, err);
        reject(err);
      } else {
        LOG.info(`Success: write data to file from blogName ${blogName}`);
        resolve();
      }
    });
  });
};

const writeContentToFile = (fileName, data) => {
  LOG.info(`write data to file from fileName ${fileName}`);
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, data, (err) => {
      if (err) {
        LOG.error(`Error: write data to file from fileName ${fileName}`, err);
        reject(err);
      } else {
        LOG.info(`Success: write data to file from fileName ${fileName}`);
        resolve();
      }
    });
  });
};

const getDataFromFile = (fileName) => {
  if (!fs.existsSync(fileName)) {
    return null;
  }
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, (err, data) => {
      if (err) {
        LOG.error(`Error: get data from file ${fileName}`, err);
        reject(err);
      } else {
        LOG.info(`Success: get data from file ${fileName}`);
        resolve(data.toString());
      }
    });
  });
};

const getDataFromRssData = (blogName) => {
  const fileName = getFileName(blogName);
  return getDataFromFile(fileName)
};

module.exports = { getFileName, writeToFile, getDataFromFile, getDataFromRssData, writeContentToFile };
