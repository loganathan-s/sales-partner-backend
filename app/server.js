const Hapi = require('hapi')
const Joi = require('joi')
const S = Joi.string

const server = new Hapi.Server()

server.connection({ port: process.env.PORT || 3000 })

// Routes
server.route([
  {
    method: 'POST',
    path: '/registerAccount',
    config: {
      handler: function (request, reply) {
        reply('Hello ' + encodeURIComponent(request.query.user) + '!')
      }
      // config: { handler: registerAccount, payload: { parse: true } }
    }
  },
  // http://localhost:3000/getRelation?address=test&key=1
  {
    method: 'GET',
    path: '/getRelation',
    config: {
      handler: function (request, reply) {
        reply(`Given Address ${encodeURIComponent(request.query.address)}`)
      },
      validate: {
        query: { address: S().required(), key: S().required() }
      }
    }
  }
])

server.register(require('hapi-heroku-helpers'), function (err) {
  if (err) {
    throw err
  }
  server.start(function () {
    console.log(`Server running at: ${server.info.uri}`)
  })
})
