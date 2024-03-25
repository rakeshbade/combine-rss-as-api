const { exec } = require('child_process');

const curlChildProcess = (curl)=>{
    return new Promise((resolve, reject)=>{
        const child = exec(curl, (error, stdout, stderr) => {
            if (error) {
              return reject(error)
            }
            return resolve(stdout)
          });
          
        
    })
}

const isWithInHours = (date, hours = 24) => {
  const timeDifference = Math.abs(new Date(date).getTime() - Date.now());
  const hoursDifference = timeDifference / (60 * 60 * 1000);
  return hoursDifference <= hours;
};

const waitFor = (timer) => {
  return new Promise((resolve) => {
    setTimeout(resolve, timer);
  });
};

module.exports = {
    curlChildProcess,
    isWithInHours,
    waitFor
}