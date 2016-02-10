'use strict'

const expect = require('expect')
const routeParameters = require('../src/routeParameters')

describe('routeParameters', () => {
  describe('formatGroupData', () => {
    it('should apply default value to undefined parameter', () => {
      const groupData = routeParameters.formatGroupData({
        properties: {
          STRING: {
            type: 'string',
            default: 'foo'
          }
        }
      },{})

      expect(groupData).toExist()
      expect(groupData.STRING).toBe('foo')
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
