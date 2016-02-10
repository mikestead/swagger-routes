'use strict'

const expect = require('expect')
const del = require('del')
const fileHandlers = require('../src/fileHandlers')
const swaggerSpec = require('../src/swaggerSpec')
const util = require('../src/util')
const applyDefaultOptions = require('../src/options').applyDefaultOptions

const api = swaggerSpec.getSpecSync('./test/_fixture/petstore.yml')
const operations = swaggerSpec.getAllOperations(api)
const operationId = 'listPets'
const listPetsOp = operations.find(op => op.id === operationId)
const options = applyDefaultOptions({
  api,
  handlers: './bin/handler'
})

describe('fileHandlers', () => {
  afterEach(() => del(options.handlers.path))

  describe('enableHandler', () => {
    it('should generate a route handler file based on operation id', () => {
      const fileInfo = fileHandlers.enableHandler(listPetsOp, options)

      expect(fileInfo.gen).toBe(true)
      expect(fileInfo.old).toBe(false)
      expect(util.existsSync(fileInfo.path)).toNotBe(false)
    })

    it('should NOT re-generate existing handler files', () => {
      const fileInfoA = fileHandlers.enableHandler(listPetsOp, options)
      const fileInfoB = fileHandlers.enableHandler(listPetsOp, options)

      expect(fileInfoA.gen).toBe(true)
      expect(fileInfoB.gen).toBe(false)
    })

    it('should renew old handler which is in use again', () => {
      fileHandlers.enableHandler(listPetsOp, options)
      fileHandlers.disableHandler(listPetsOp, options)
      const fileInfo = fileHandlers.enableHandler(listPetsOp, options)

      expect(fileInfo.gen).toBe(false)
      expect(fileInfo.old).toBe(false)
      expect(fileInfo.id).toBe(operationId)
    })
  })

  describe('disableHandler', () => {
    it('should prefix underscore to handler files no longer in use', () => {
      const fileInfoA = fileHandlers.enableHandler(listPetsOp, options)
      const fileInfoB = fileHandlers.disableHandler(listPetsOp, options)

      expect(fileInfoA.gen).toBe(true)
      expect(fileInfoA.old).toBe(false)
      expect(fileInfoA.id).toBe(operationId)

      expect(fileInfoB.gen).toBe(false)
      expect(fileInfoB.old).toBe(true)
      expect(fileInfoB.id).toBe(`_${operationId}`)
    })
  })

  describe('disableOldHandlers', () => {
    it('should disable handlers for operations which no longer exist', () => {
      const listPetsOp2 = Object.assign({}, listPetsOp, { id: `${operationId}2` })
      fileHandlers.enableHandler(listPetsOp2, options)
      const fileInfos = fileHandlers.disableOldHandlers(operations, options)
      const fileInfo = fileInfos[0]

      expect(fileInfo.gen).toBe(false)
      expect(fileInfo.old).toBe(true)
      expect(fileInfo.id).toBe(`_${operationId}2`)
    })
  })
})
