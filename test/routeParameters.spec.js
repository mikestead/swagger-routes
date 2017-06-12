'use strict'

const expect = require('expect')
const routeParameters = require('../src/routeParameters')

describe('routeParameters', () => {
  describe('formatGroupData', () => {
    it('should convert string to boolean', () => {
      const props = {
        properties: {
          BOOLEAN: {
            type: 'boolean',
            default: 'foo'
          }
        }
      }
      let groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'true' })
      expect(groupData.BOOLEAN).toBe(true)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'yes' })
      expect(groupData.BOOLEAN).toBe(true)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'y' })
      expect(groupData.BOOLEAN).toBe(true)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: '1' })
      expect(groupData.BOOLEAN).toBe(true)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'TRUE' })
      expect(groupData.BOOLEAN).toBe(true)

      groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'false' })
      expect(groupData.BOOLEAN).toBe(false)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'no' })
      expect(groupData.BOOLEAN).toBe(false)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'n' })
      expect(groupData.BOOLEAN).toBe(false)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: '0' })
      expect(groupData.BOOLEAN).toBe(false)
      groupData = routeParameters.formatGroupData(props, { BOOLEAN: 'FALSE' })
      expect(groupData.BOOLEAN).toBe(false)
    })

    it('should apply default value to undefined parameter', () => {
      const req = {}
      const groupData = routeParameters.formatGroupData({
        properties: {
          STRING: {
            type: 'string',
            default: 'foo'
          }
        }
      },{}, '', req)

      expect(groupData).toExist()
      expect(groupData.STRING).toBe('foo')
      expect(req.appliedDefaults).toExist()
      expect(req.appliedDefaults['STRING']).toBeTruthy()
    })

    it('should ignore default value on required parameter', () => {
      const groupData = routeParameters.formatGroupData({
        properties: {
          STRING: {
            type: 'string',
            default: 'foo',
            required: true
          }
        }
      },{})

      expect(groupData).toExist()
      expect(groupData.STRING).toNotExist()
    })

    Object.keys(routeParameters.COLLECTION_FORMAT).forEach(format => {
      it(`should convert ${format} collection format to array`, () => {
        const DELIM = routeParameters.COLLECTION_FORMAT[format]
        const VALUE = [ 'a','b','c' ].join(DELIM)
        const groupData = routeParameters.formatGroupData({
          properties: {
            ARRAY: {
              type: 'array',
              items: {
                type: 'string'
              },
              collectionFormat: format.toLowerCase()
            }
          }
        },{
          ARRAY: VALUE
        })
        expect(groupData.ARRAY).toBeAn(Array)
        expect(groupData.ARRAY.join(DELIM)).toBe(VALUE)
      })
    })
  })
})
