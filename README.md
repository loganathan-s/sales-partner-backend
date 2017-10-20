# Sales partner Backend App

A web application to manage sales commissions with the Fury network. WIP

## Setup

- make sure [node.js](http://nodejs.org) is at version >= `6`
- clone this repo down and `cd` into the folder
- run `yarn install ` or `npm install`
- run `npm run watch` and `npm start`
- this will start the server in development machine

## Testing

Tests are located in `test/**` and are powered by [ava](https://github.com/avajs/ava)
- `yarn install ` or `npm install` to ensure devDeps are installed
- `npm test` to run test suite

## App structure

### JavaScript

JS files are located in `app/js`. The backend end libary is [HapiJS](https://hapijs.com)

#### service.js
`app/server.js` is where everything is being put together: The app consists of:
1. Some basic server settings
2. A simple route resolver for client side routing.
