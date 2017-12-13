'use strict'

const expect = require('expect')
const restify = require('restify')
const express = require('express')
const addHandlers = require('../src/index')
const swaggerSpec = require('../src/swaggerSpec')

const secureApi = swaggerSpec.getSpecSync('./test/_fixture/secure-petstore.yml')
const api = swaggerSpec.getSpecSync('./test/_fixture/secure-petstore.yml')

delete api.securityDefinitions
delete api.paths['/pets'].post.security

const options = {
  api,
  docsPath: '/api-docs',
  handlers: () => function handler() {},
  authorizers: () => function authorizer() {}
}

describe('index', () => {
  [ 'express', 'restify' ].forEach(lib => {
    describe(lib, () => {
      describe('addRoutes', () => {
        const isExpress = lib === 'express'
        const verifyRoute = isExpress ? verifyExpressRoute : verifyRestifyRoute
        let app = null

        beforeEach(() => {
          if (isExpress) app = express()
          else app = restify.createServer()
        })

        afterEach(() => {
          if (!isExpress) app.close()
        })

        it('should translate swagger operation into route', () => {
          addHandlers(app, options)

          verifyAppStackSize(app, 2)

          verifyRoute(app, '/pets', [ 'augmentReq', 'validator', 'handler' ])
          verifyRoute(app, options.docsPath, [ 'docsMiddleware', 'handler' ])
        })

        it('should always register doc route', () => {
          const api2 = Object.assign({}, api)
          delete api2.paths
          const options2 = Object.assign({}, options, { api: api2 })
          addHandlers(app, options2)

          verifyAppStackSize(app, 1)

          verifyRoute(app, options.docsPath, [ 'docsMiddleware', 'handler' ])
        })

        it('should support handler middleware', () => {
          const options2 = Object.assign({}, options)
          options2.handlers = {
            create: () => ({
              middleware: function middleware() {},
              handler: function handler() {}
            })
          }

          addHandlers(app, options2)
          verifyRoute(app, '/pets', [ 'augmentReq', 'middleware', 'validator', 'handler' ])
        })

        it('should support post validation middleware', () => {
          const options2 = Object.assign({}, options)
          options2.handlers = {
            create: () => ({
              middleware: { action: function middleware() {}, validated: true },
              handler: function handler() {}
            })
          }

          addHandlers(app, options2)
          verifyRoute(app, '/pets', [ 'augmentReq', 'validator', 'middleware', 'handler' ])
        })

        it('should support handler multi-middleware', () => {
          const options2 = Object.assign({}, options)
          options2.handlers = {
            create: () => ({
              middleware: [
                function middleware1() {},
                function middleware2() {}
              ],
              handler: function handler() {}
            })
          }

          addHandlers(app, options2)
          verifyRoute(app, '/pets', [ 'augmentReq', 'middleware1', 'middleware2', 'validator', 'handler' ])
        })

        it('should support pre and post validation middleware', () => {
          const options2 = Object.assign({}, options)
          options2.handlers = {
            create: () => ({
              middleware: [
                function middlewarePre() {},
                { action: function middlewarePost() {}, validated: true }
              ],
              handler: function handler() {}
            })
          }

          addHandlers(app, options2)
          verifyRoute(app, '/pets', [ 'augmentReq', 'middlewarePre', 'validator', 'middlewarePost', 'handler' ])
        })

        it('should add auth middleware to secure routes', () => {
          const options2 = Object.assign({}, options, { api: secureApi })

          addHandlers(app, options2)
          verifyRoute(app, '/pets', [ 'augmentReq', 'authorize', 'validator', 'handler' ])
        })

        it('should add auth middleware before other route middleware', () => {
          const options2 = Object.assign({}, options, { api: secureApi })
          options2.handlers = {
            create: () => ( {
              middleware: function middleware() {},
              handler: function handler() {}
            })
          }

          addHandlers(app, options2)
          verifyRoute(app, '/pets', [ 'augmentReq', 'authorize', 'middleware', 'validator', 'handler' ])
        })

        it('should support registering multiple Swagger api specs', () => {
          const api2 = Object.assign({}, api, { basePath: '/v2' })
          const options2 = Object.assign({}, options, { api: api2 })

          addHandlers(app, options)
          addHandlers(app, options2)

          verifyAppStackSize(app, 4)

          verifyRoute(app, '/pets', [ 'augmentReq', 'validator', 'handler' ], api.basePath)
          verifyRoute(app, options.docsPath, [ 'docsMiddleware', 'handler' ], api.basePath)

          verifyRoute(app, '/pets', [ 'augmentReq', 'validator', 'handler' ], api2.basePath)
          verifyRoute(app, options.docsPath, [ 'docsMiddleware', 'handler' ], api2.basePath)
        })

        it('should expose swagger apis via app/server property', () => {
          const api2 = Object.assign({}, api, { basePath: '/v2' })
          const options2 = Object.assign({}, options, { api: api2 })

          addHandlers(app, options)
          addHandlers(app, options2)

          expect(app.swagger).toExist()
          expect(app.swagger.size).toBe(2)
        })
      })
    })
  })
})

function verifyExpressRoute(app, path, stackNames, basePath) {
  basePath = basePath || api.basePath
  path = `${basePath}${path}`
  const layer = app._router.stack.find(layer => layer.route ? layer.route.path === path : false)
  const route = layer ? layer.route : null
  expect(route).toExist()
  expect(route.path).toBe(path)
  verifyRouteStack(route.stack, stackNames)
}

function verifyRestifyRoute(app, path, stackNames, basePath) {
  basePath = basePath || api.basePath
  path = `${basePath}${path}`
  const method = path.endsWith('/api-docs') ? 'get' : 'post'
  const name = `${method}${path.replace(/[ -\/]/g, '')}`
  const route = app.router.mounts[name]
  expect(route).toExist()
  expect(route.spec.path).toBe(path)
  verifyRouteStack(app.routes[name], stackNames)
}

function verifyRouteStack(stack, names) {
  expect(stack.length).toBe(names.length)
  names.forEach((name, i) => expect(stack[i].name).toBe(name))
}

function verifyAppStackSize(app, size) {
  if (app._router) expect(app._router.stack.length - 2).toBe(size)
  else expect(Object.keys(app.router.mounts).length).toBe(size)
}
