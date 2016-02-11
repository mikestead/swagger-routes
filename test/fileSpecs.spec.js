'use strict'

const expect = require('expect')
const del = require('del')
const fileSpecs = require('../src/fileSpecs')
const swaggerSpec = require('../src/swaggerSpec')
const util = require('../src/util')
const fs = require('fs')
const applyDefaultSpecOptions = require('../src/options').applyDefaultSpecOptions

const api = swaggerSpec.getSpecSync('./test/_fixture/petstore.yml')
const operations = swaggerSpec.getAllOperations(api)
const operationId = 'listPets'
const listPetsOp = operations.find(op => op.id === operationId)
const options = applyDefaultSpecOptions({
  api,
  specs: './bin/specs'
})

describe('fileSpecs', () => {
  afterEach(() => del(options.specs.path))

  describe('enableSpec', () => {
    it('should generate a spec file based on operation id', () => {
      const fileInfo = fileSpecs.enableSpec(listPetsOp, options)

      expect(fileInfo.gen).toBe(true)
      expect(fileInfo.old).toBe(false)
      expect(util.existsSync(fileInfo.path)).toNotBe(false)
    })

    it('should NOT re-generate existing spec files', () => {
      const fileInfoA = fileSpecs.enableSpec(listPetsOp, options)
      const fileInfoB = fileSpecs.enableSpec(listPetsOp, options)

      expect(fileInfoA.gen).toBe(true)
      expect(fileInfoB.gen).toBe(false)
    })

    it('should renew old spec which is in use again', () => {
      fileSpecs.enableSpec(listPetsOp, options)
      fileSpecs.disableSpec(listPetsOp, options)
      const fileInfo = fileSpecs.enableSpec(listPetsOp, options)

      expect(fileInfo.gen).toBe(false)
      expect(fileInfo.old).toBe(false)
      expect(fileInfo.id).toBe(operationId)
    })

    it('should update header docs when swagger spec changes', () => {
      const options2 = Object.assign({ syncHeaders: true }, options)
      const fileInfo = fileSpecs.enableSpec(listPetsOp, options2)
      const contents1 = fs.readFileSync(fileInfo.path, 'utf8') + '\nEDIT\n'

      fs.writeFileSync(fileInfo.path, contents1)
      const listPetsOp2 = Object.assign({}, listPetsOp, { summary: listPetsOp.summary + 'NEW' })
      fileSpecs.enableSpec(listPetsOp2, options2)

      const expected = contents1.split(listPetsOp.summary).join(`${listPetsOp.summary}NEW`)
      const contents2 = fs.readFileSync(fileInfo.path, 'utf8')

      expect(contents2).toBe(expected)
    })
  })

  describe('disableSpec', () => {
    it('should prefix underscore to spec files no longer in use', () => {
      const fileInfoA = fileSpecs.enableSpec(listPetsOp, options)
      const fileInfoB = fileSpecs.disableSpec(listPetsOp, options)

      expect(fileInfoA.gen).toBe(true)
      expect(fileInfoA.old).toBe(false)
      expect(fileInfoA.id).toBe(operationId)

      expect(fileInfoB.gen).toBe(false)
      expect(fileInfoB.old).toBe(true)
      expect(fileInfoB.id).toBe(`_${operationId}`)
    })
  })

  describe('disableOldSpecs', () => {
    it('should disable specs for operations which no longer exist', () => {
      const listPetsOp2 = Object.assign({}, listPetsOp, { id: `${operationId}2` })
      fileSpecs.enableSpec(listPetsOp2, options)
      const fileInfos = fileSpecs.disableOldSpecs(operations, options)
      const fileInfo = fileInfos[0]

      expect(fileInfo.gen).toBe(false)
      expect(fileInfo.old).toBe(true)
      expect(fileInfo.id).toBe(`_${operationId}2`)
    })
  })
})
