// TODO
const callback = function (enabledJobs) {
  // Do something with enabledJobs
}

// TODO
const enabledCallback = function (job, scheduleParsed) {
  // Do something with job and scheduleParsed
}

// Add all scheduled jobs here
const jobs = [
  {
    name: 'Read Data from CSV file',
    enabled: true,
    enabledCallback: enabledCallback, // Executed at end of import of the job, just before immediate Callback
    immediate: false, // Will execute function on starting the server
    // schedule: 'at 12:00 am',
    schedule: 'every 50 s',
    execute: require('../app/js/app').createTestRun
  }
]

module.exports = { jobs, callback }
