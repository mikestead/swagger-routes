'use strict'

const expect = require('expect')
const restify = require('restify')
const express = require('express')
const exp = require('../src/index')

const api = {
	basePath: '/v1',
	securityDefinitions: {
		petstore_auth: {
			type: 'oauth2',
			authorizationUrl: 'http://swagger.io/api/oauth/dialog',
			flow: 'implicit',
			scopes: {
				'write:pets': 'modify pets in your account',
				'read:pets': 'read your pets'
			}
		}
	},
	'paths': {
		'/pets': {
			'get': {
				'tags': [ 'Pet Operations' ],
				'summary': 'finds pets in the system',
				'responses': {
					'204': {
						'description': 'pet response',
						type: 'string'
					}
				}
			}
		}
	}
}

const secureApi = Object.assign({}, api, {
	paths: {
		'/pets': {
			get: {
				security: [ {
					petstore_auth: [
						'write:pets',
						'read:pets'
					]
				} ]
			}
		}
	}
})

const options = {
	api,
	docsPath: '/api-docs',
	createHandler: () => function handler() {},
	createAuthorizer: () => function authorizer() {}
}

function verifyExpressRoute(app, path, stackNames) {
	path = `${api.basePath}${path}`
	const layer = app._router.stack.find(layer => layer.route ? layer.route.path === path : false)
	const route = layer ? layer.route : null
	expect(route).toExist()
	expect(route.path).toBe(path)
	verifyRouteStack(route.stack, stackNames)
}

function verifyRestifyRoute(app, path, stackNames) {
	path = `${api.basePath}${path}`
	const name = `get${path.replace(/[ -\/]/g, '')}`
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
					exp.addRoutes(app, options)

					verifyAppStackSize(app, 2)

					verifyRoute(app, '/pets', [ 'validator', 'handler' ])
					verifyRoute(app, options.docsPath, [ 'handler' ])
				})

				it('should always register doc route', () => {
					const api2 = Object.assign({}, api)
					delete api2.paths
					const options2 = Object.assign({}, options, { api: api2 })
					exp.addRoutes(app, options2)

					verifyAppStackSize(app, 1)

					verifyRoute(app, options.docsPath, [ 'handler' ])
				})

				it('should support handler middleware', () => {
					const options2 = Object.assign({}, options)
					options2.createHandler = () => ( {
						middleware: function middleware() {},
						handler: function handler() {}
					} )

					exp.addRoutes(app, options2)
					verifyRoute(app, '/pets', [ 'middleware', 'validator', 'handler' ])
				})

				it('should support handler multi-middleware', () => {
					const options2 = Object.assign({}, options)
					options2.createHandler = () => ( {
						middleware: [
							function middleware1() {},
							function middleware2() {}
						],
						handler: function handler() {}
					})

					exp.addRoutes(app, options2)
					verifyRoute(app, '/pets', [ 'middleware1', 'middleware2', 'validator', 'handler' ])
				})

				it('should add auth middleware to secure routes', () => {
					const options2 = Object.assign({}, options, { api: secureApi })

					exp.addRoutes(app, options2)
					verifyRoute(app, '/pets', [ 'authorize', 'validator', 'handler' ])
				})

				it('should add auth middleware before other route middleware', () => {
					const options2 = Object.assign({}, options, { api: secureApi })
					options2.createHandler = () => ( {
						middleware: function middleware() {},
						handler: function handler() {}
					})

					exp.addRoutes(app, options2)
					verifyRoute(app, '/pets', [ 'authorize', 'middleware', 'validator', 'handler' ])
				})
			})
		})
	})
})
