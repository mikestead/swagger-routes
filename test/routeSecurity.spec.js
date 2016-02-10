'use strict'

const expect = require('expect')
const swaggerSpec = require('../src/swaggerSpec')
const routeSecurity = require('../src/routeSecurity')
const applyDefaultOptions = require('../src/options').applyDefaultOptions

const secureApi = swaggerSpec.getSpecSync('./test/_fixture/secure-petstore.yml')
const securityDefinitions = secureApi.securityDefinitions
const schemeIdA = 'petstore_auth'
const schemeIdB = 'petstore_auth2'

const options = applyDefaultOptions({
  authorizers: () => () => {}
})

describe('routeSecurity', () => {
  describe('getAuthorizers', () => {
    it('should return map of security scheme id => authorizer function', () => {
      const map = routeSecurity.getAuthorizers(securityDefinitions, options)

      expect(map).toExist()
      expect(map.size).toBe(2)
      expect(map.get(schemeIdA)).toBeA('function')
      expect(map.get(schemeIdB)).toBeA('function')
    })
  })

  describe('createAuthCheck', () => {
    const operationId = 'createPets'
    let createPetsOp

    beforeEach(() => {
      const operations = swaggerSpec.getAllOperations(secureApi)
      createPetsOp = operations.find(op => op.id === operationId)
    })

    it('should pass authorization if correct security scopes provided', () => {
      const security2 = {}
      security2[schemeIdB] = [ 'scopeA' ]
      createPetsOp.security.push(security2)

      let checkA = true
      let checkB = true
      let error = true

      const authorizers = new Map()
      authorizers.set(schemeIdA, (req, res, next) => {
        const allScopes = Object.keys(securityDefinitions[schemeIdA].scopes)
        checkA = req.verifyScopes(allScopes)
        next(checkA)
      })
      authorizers.set(schemeIdB, (req, res, next) => {
        const allScopes = Object.keys(securityDefinitions[schemeIdB].scopes)
        checkB = req.verifyScopes(allScopes)
        next(checkB)
      })
      const authorize = routeSecurity.createAuthCheck(createPetsOp, authorizers)
      const next = e => error = e
      return authorize({}, {}, next)
        .then(() => {
          expect(checkA).toNotExist()
          expect(checkB).toNotExist()
          expect(error).toNotExist()
        })
    })

    it('should fail authorization if required security scope is missing', () => {
      let error
      const authorizers = new Map()
      authorizers.set(schemeIdA, (req, res, next) => {
        next(req.verifyScopes([]))
      })

      const authorize = routeSecurity.createAuthCheck(createPetsOp, authorizers)
      const next = e => error = e
      return authorize({}, {}, next)
        .then(() => {
          expect(error).toExist()
          expect(error.status).toBe(403)
        })
    })

    it('should fail authorization if authorizer is missing', () => {
      let error
      const authorize = routeSecurity.createAuthCheck(createPetsOp, new Map())
      const next = e => error = e
      return authorize({}, {}, next)
        .then(() => {
          expect(error).toExist()
          expect(error.status).toBe(401)
        })
    })

    it('should fail on first authorization error', () => {
      const security2 = {}
      security2[schemeIdB] = [ 'scopeA' ]
      createPetsOp.security.push(security2)

      let errorA = true
      let errorB = true
      let finalError = true

      const authorizers = new Map()
      authorizers.set(schemeIdA, (req, res, next) => {
        errorA = req.verifyScopes([ 'write:pets' ]) // missing a required scope so should fail
        next(errorA)
      })
      authorizers.set(schemeIdB, (req, res, next) => {
        errorB = req.verifyScopes([ 'scopeA' ])
        next(errorB)
      })
      const authorize = routeSecurity.createAuthCheck(createPetsOp, authorizers)
      const next = e => finalError = e
      return authorize({}, {}, next)
        .then(() => {
          expect(errorA).toExist()
          expect(errorB).toNotExist()
          expect(finalError).toEqual(errorA)
        })

    })
  })
})
