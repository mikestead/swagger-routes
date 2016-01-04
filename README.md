# Swagger Routes

[![Build Status](https://travis-ci.org/mikestead/swagger-routes.svg?branch=master)](https://travis-ci.org/mikestead/swagger-routes) [![npm version](https://img.shields.io/npm/v/swagger-routes.svg?style=flat-square)](https://www.npmjs.com/package/swagger-routes)

A tool to generate and register [Restify](http://restify.com) or [Express](http://expressjs.com) routes from a 
[Swagger](http://swagger.io) ([OpenAPI](https://openapis.org)) specification.


## Operation Handlers

You have the option to define and maintain a handler file for each Swagger operation, or alternatively
provide a factory function which returns a handler given an operation.

Using individual handler files is a good choice if each handler needs unique logic 
to deal with its incoming request.

The factory is a better option if all handlers are quite similar e.g. delegate their request
processing onto service classes.

### Generate Handler Files

If you opt for the handler files, there's a bundled tool to generate these files based on operations in
your Swagger spec and a [Mustache](https://mustache.github.io) template file.

```javascript
import { genHandlers } from 'swagger-routes'

genHandlers(
	'./api.yml',    // path to your Swagger spec, or the loaded spec reference
	'./handlers',   // director path to write handler files
	options         // options (optional)
)
```

#### Available Options

- `templateFile`: Path to the Mustache template for your handler. Defaults to [this](https://github.com/mikestead/swagger-routes/blob/master/template/handler.mustache),
- `template`: Loaded Mustache template to use instead of `templateFile`. Defaults to `undefined`.
- `getTemplateView`: Function which takes an operation and returns the data to feed to the template. Defaults to return the operation.

If you re-run `genHandlers` over existing handlers the originals will remain in place, i.e. this
operation is non-destructive.

If a re-run finds handlers no longer in use they will be renamed with an `_` prefix, so
`listPets.js` would become `_listPets.js`. This allows you to identify handlers no longer in use
and remove them if you wish.

If later you enabled a handler again in your spec and re-run, then the underscore will be removed.

## Register Handlers

```javascript
import { addRoutes } from 'swagger-routes'

addRoutes(app, {        // express app or restify server
	api: './api.yml'    // path to your Swagger spec, or the loaded spec reference
})
```
#### Other Options

- `docsPath`: path to serve your swagger api json. Defaults to `/api-docs`.
- `handlers`: directory where your handler files reside. Defaults to `./handlers`.
- `security`: directory where your authorizer files reside. Defaults to `./security`.
- `createHandler`: Function to create handlers. If specified, overrides `handlers` file lookup.
- `createAuthorizer`: Factory to create authorizers. If specified, overrides `security` authorizer file lookup.

### Operation Object

An operation object inherits its properties from those defined in the [Swagger spec](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#operationObject).

There are only a few differences / additions.

- `id`: Replaces `operationId`.
- `path`: The route path of this operation.
- `method`: The http method
- `consumes`: Populated with the top level `consumes` unless the operation defines its own.
- `produces`: Populated with the top level `produces` unless the operation defines its own.
- `paramGroupSchemas`: JSON Schema for each param group ('header', 'path', 'query', 'body', 'formData') relevant to the operation.
