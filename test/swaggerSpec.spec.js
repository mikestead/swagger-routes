'use strict'

const expect = require('expect')
const swaggerSpec = require('../src/swaggerSpec')

describe('swaggerSpec', () => {
	describe('getAllOperations', () => {
		let spec = null

		beforeEach(() => {
			spec = swaggerSpec.getSpecSync('./test/_fixture/petstore.yml')
		})

		it('should resolve parameter schema references', () => {
			const paramSpec = {
				PetId: {
					name: 'petId',
					in: 'path',
					required: true,
					type: 'string'
				}
			}
			spec.parameters = paramSpec
			spec.paths['/pets/{petId}'].get.parameters[0] = {
				$ref: '#/parameters/PetId'
			}
			const operations = swaggerSpec.getAllOperations(spec)
			const opt = operations.find(opt => opt.id === 'showPetById')
			const param = opt.parameters[0]

			expect(param).toEqual(paramSpec.PetId)
		})

		it('should resolve parameter body schema reference', () => {
			spec.paths['/pets/{petId}'].put = {
				operationId: 'updatePet',
				parameters: [ {
					in: 'body',
					schema: {
						$ref: '#/definitions/Pet'
					}
				} ]
			}
			const operations = swaggerSpec.getAllOperations(spec)
			const opt = operations.find(opt => opt.id === 'updatePet')
			const bodySchema = opt.parameters[0].schema

			expect(bodySchema).toEqual(spec.definitions.Pet)
		})

		it('should resolve parameter array items reference', () => {
			spec.paths['/pets/{petId}'].get = {
				operationId: 'updatePet',
				parameters: [ {
					in: 'body',
					schema: {
						type: 'array',
						items: {
							$ref: '#/definitions/Pet'
						}
					}
				} ]
			}
			const operations = swaggerSpec.getAllOperations(spec)
			const opt = operations.find(opt => opt.id === 'updatePet')
			const bodySchema = opt.parameters[0].schema

			expect(bodySchema.items).toEqual(spec.definitions.Pet)
		})

		it('should inherit correct consumes and produces', () => {
			const consumes = [ 'application/vnd.github.v3+json' ]
			const produces = [ 'text/plain; charset=utf-8' ]
			const showPetById = spec.paths['/pets/{petId}'].get
			showPetById.consumes = consumes
			showPetById.produces = produces

			const operations = swaggerSpec.getAllOperations(spec)
			const opt = operations.find(opt => opt.id === 'showPetById')
			expect(opt.consumes).toEqual(consumes)
			expect(opt.produces).toEqual(produces)
		})

		it('should resolve response schemas references', () => {
			const operations = swaggerSpec.getAllOperations(spec)
			const opt = operations.find(opt => opt.id === 'listPets')
			expect(opt.responseSchemas['200']).toExist()
			expect(opt.responseSchemas['200'].bodySchema).toEqual({
				type: 'array',
				items: {
					required: [
						'id',
						'name'
					],
					properties: {
						id: {
							type: 'integer',
							format: 'int64'
						},
						name: {
							type: 'string'
						},
						tag: {
							type: 'string'
						}
					}
				}
			})
		})

		it('should formulate response headers schema', () => {
			const operations = swaggerSpec.getAllOperations(spec)
			const opt = operations.find(opt => opt.id === 'listPets')
			expect(opt.responseSchemas['200']).toExist()
			expect(opt.responseSchemas['200'].headersSchema).toEqual({
				type: 'object',
				properties: {
					'x-next': {
						type: 'string',
						description: 'A link to the next page of responses'
					}
				},
				required: []
			})
		})
	})
})
