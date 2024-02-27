const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

const zipAllFiles = ()=>{
  const output = fs.createWriteStream('all_files.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Compression level (optional)
  });
    // Pipe the ZIP archive to the response
    archive.pipe(output);

  // Add files from each directory to the ZIP archive
 ["config","services","utils"].forEach((dir) => {
    const filesInDir = fs.readdirSync(dir);
    filesInDir.forEach((file) => {
      archive.file(`${dir}/${file}`, { name: `${dir}/${file}` });
    });
  });
  archive.file(`index.js`, { name: `index.js` });
  // Finalize the ZIP archive
  archive.finalize();
  return archive;
}

module.exports = {zipAllFiles}