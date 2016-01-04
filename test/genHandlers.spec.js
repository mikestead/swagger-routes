'use strict'

const expect = require('expect')
const fs = require('fs')
const del = require('del')
const genHandlers = require('../src/genHandlers')
const swaggerSpec = require('../src/swaggerSpec')
const SPEC = 'test/_fixture/petstore.yml'
const BIN = 'bin/handler'

describe('genHandlers', () => {
	afterEach(() => del(BIN))

	it('should generate route handler files based on operation ids', () =>
		genHandlers(SPEC, BIN)
			.then(files => {
				const genFiles = fs.readdirSync(BIN)

				expect(files.length).toBe(genFiles.length)

				genFiles.forEach(name => {
					const path = `${BIN}/${name}`
					const file = files.find(file => file.path === path)
					expect(file).toExist()
					expect(file.gen).toBe(true)
				})
			})
	)

	it('should not re-generate existing handler files', () =>
		genHandlers(SPEC, BIN)
			.then(files => {
				const firstFile = files[0]
				return del(firstFile.path)
						.then(() => genHandlers('test/_fixture/petstore.yml', BIN))
						.then(files =>
							files.forEach(file =>
								expect(file.gen).toBe((file.path == firstFile.path))))
			})
	)

	it('should prefix underscore to handler files no longer in use', () =>
		genHandlers(SPEC, BIN)
			.then(files => {
				const fileA = files.find(file => file.id === 'showPetById')
				expect(fileA.old).toBe(false)

				const spec = swaggerSpec.getSpecSync(SPEC)
				delete spec.paths['/pets/{petId}']
				return genHandlers(spec, BIN)
					.then(files => {
						const fileB = files.find(file => file.id === 'showPetById')
						expect(fileB.old).toBe(true)
					})
			})
	)

	it('should renew old handler which is in use again', () =>
		genHandlers(SPEC, BIN)
			.then(() => {
				const spec = swaggerSpec.getSpecSync(SPEC)
				delete spec.paths['/pets/{petId}']
				return genHandlers(spec, BIN)
					.then(() => {
						return genHandlers(SPEC, BIN)
							.then(files => {
								const fileB = files.find(file => file.id === 'showPetById')
								expect(fileB.old).toBe(false)
							})
					})
			})
	)
})
