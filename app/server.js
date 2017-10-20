const Hapi = require('hapi')
const Joi = require('joi')
const Good = require('good')
const S = Joi.string

const server = new Hapi.Server()
server.connection({ port: 3000, host: 'localhost' })

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

server.start(err => {
  if (err) {
    throw err
  }
  console.log(`Server running at: ${server.info.uri}`)
})
