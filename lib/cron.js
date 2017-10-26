const createTestRun = require('../app/js/app')

// TODO
const callback = function (enabledJobs) {
  // Do something with enabledJobs
}

// TODO
const enabledCallback = function (job, scheduleParsed) {
  // Do something with job and scheduleParsed
}

// Add all scheduled jobs here
const cronJobs = [
  {
    name: 'Read Data from CSV file',
    enabled: true,
    enabledCallback: enabledCallback, // Executed at end of import of the job, just before immediate Callback
    immediate: false, // Will execute function on starting the server
    schedule: 'at 12:00 am',
    execute: createTestRun
  }
]

module.exports = { jobs: cronJobs, callback }
