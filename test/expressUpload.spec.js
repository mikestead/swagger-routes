'use strict'

const fs = require('fs')
const expect = require('expect')
const express = require('express')
const FormData = require('form-data')
const swaggered = require('../src/index')
const multer = require('multer')
const concat = require('concat-stream')
const onFinished = require('on-finished')

const PORT = 32832

describe('expressUpload', () => {
	describe('image', () => {
		let app

		before(done => {
			app = express()
			app.listen(PORT, done)
		})

		function readFile(name) {
			return fs.createReadStream(`test/_fixture/upload/${name}`)
		}

		function submitForm(form, path, cb) {
			const req = form.submit(`http://localhost:${PORT}${path}`)
			req.on('error', cb)
			req.on('response', function (res) {
				res.on('error', cb)
				res.pipe(concat({ encoding: 'buffer' }, function (body) {
					onFinished(req, function () { cb(null, res, body) })
				}))
			})
		}

		it('should support file upload', done => {
			const upload = multer({})
			let hasFileA = false
			let hasFileB = false
			swaggered.addRoutes(app, {
				api: 'test/_fixture/upload/file-api.yml',
				createHandler: () => ( {
					middleware: upload.fields([ { name: 'fileA' }, { name: 'fileB' } ]),
					handler: function handler(req, res) {
						hasFileA = !!req.files.fileA
						hasFileB = !!req.files.fileB
						res.status(204).send()
					}
				} )
			})

			app.use((err, req, res) => {
				res.status(500).end('ERROR')
			})

			const form = new FormData()
			form.append('fileA', readFile('small-file.dat'))
			form.append('fileB', readFile('small-file.dat'))
			form.append('message', 'hello')

			submitForm(form, '/upload', () => {
				expect(hasFileA).toBe(true)
				expect(hasFileB).toBe(true)
				done()
			})
		})
	})
})
