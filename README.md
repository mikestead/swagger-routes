# Swagger Routes

[![Build Status](https://travis-ci.org/mikestead/swagger-routes.svg?branch=master)](https://travis-ci.org/mikestead/swagger-routes) [![npm version](https://img.shields.io/npm/v/swagger-routes.svg?style=flat-square)](https://www.npmjs.com/package/swagger-routes)

A tool to generate and register [Restify](http://restify.com) or [Express](http://expressjs.com) routes from a 
[Swagger](http://swagger.io) ([OpenAPI](https://openapis.org)) specification.

### Usage

```javascript
import { addRoutes } from 'swagger-routes'

addRoutes(app, {        // express app or restify server
    api: './api.yml'    // path to your Swagger spec, or the loaded spec reference
})
```
##### Options

- `api`: path to your Swagger spec, or the loaded spec reference.
- `docsPath`: url path to serve your swagger api json. Defaults to `/api-docs`.
- `handlers`: directory where your handler files reside. Defaults to `./handlers`.
- `security`: directory where your authorizer files reside. Defaults to `./security`.
- `createHandler`: Function to create handlers. If specified, overrides `handlers` file lookup.
- `createAuthorizer`: Function to create authorizers. If specified, overrides `security` authorizer file lookup.

### Operation Handlers

You have the option to define and maintain a handler file for each Swagger operation, or alternatively
provide a factory function which creates a handler function given an operation.

#### Handler Files

Using individual handler files is a good choice if each handler needs quite unique logic 
to deal with an operation request.

A handler file must be named after the Swagger operation it handles e.g. `listPets.js`, and all 
handler files must reside in the same directory.

##### File Contents

A function called `handler` should be exported to deal with an incoming operation request.

```javascript
export function handler(req, res) {
   
}
```
You also have the option to export a `middleware` function to be executed before the handler.

```javascript
export const middleware = preprocess

function preprocess(req, res, next) {
    next()
}
```
Middleware can be an ordered list.

```javascript
export const middleware = [
    (req, res, next) => next(), // 1
    (req, res, next) => next()  // 2
]
```

##### Generating Handler Files

To save you a bunch of boilerplate there's a bundled tool to generate handler files based on operations in
your Swagger spec using a [Mustache](https://mustache.github.io) template.

```javascript
import { genHandlers } from 'swagger-routes'

genHandlers(
    './api.yml',    // path to your Swagger spec, or the loaded spec reference
    './handlers',   // directory to write operation your handler files
    options
)
```

###### Options

- `templateFile`: path to the Mustache template for your handler. Defaults to point at  [this](https://github.com/mikestead/swagger-routes/blob/master/template/handler.mustache),
- `template`: loaded Mustache template to use instead of `templateFile`. Defaults to `undefined`.
- `getTemplateView`: function which takes an operation and returns the data to feed to the template. Defaults to return the operation.

If you re-run `genHandlers` over existing handlers the originals will remain in place, i.e. this
operation is non-destructive.

When a re-run finds handlers no longer in use they will be renamed with an `_` prefix, so
`listPets.js` would become `_listPets.js`. This allows you to identify handlers no longer in use
and remove them if you wish.

If later you enabled a handler again in your spec and re-run, then the underscore will be removed.

#### Handler Factory

The factory function is a better option to a file if handlers are quite similar e.g. delegate their request
processing onto service classes.

##### Create Handler Function

You can define a `createHandler` function when registering your routes. It takes a Swagger operation and returns the request handler responsible for dealing with it.

If a handler function is returned then it will take precedence over a handler file for the same operation.

```javascript
import { addRoutes } from 'swagger-routes'

addRoutes(app, {
    api: './api.yml',
    createHandler
})

function createHandler(operation) {
    return function handler(req, res, next) {
        res.send(operation.id)
    }
}
```

##### Route Middleware

Just as a file handler can define route middleware, so can the `createHandler`.

```javascript
function createHandler(operation) {
    return {
        middleware: (req, res, next) => next(),
        handler: (req, res) => res.send(operation.id)
    }
}
```

Route middleware can define an ordered list too.

```javascript
function createHandler(operation) {
    return {
        middleware: [
            (req, res, next) => next(), // 1
            (req, res, next) => next()  // 2
        ],
        handler: (req, res) => res.send(operation.id)
    }
}
```
#### Route Stack Execution Order

1. authorizer middleware: If there are security restrictions on a route then an authorizer will need to verify the request first.
2. custom middleware: If the route defines one or more middleware these will be executed in order next.
3. validation middleware: The incoming request will now be validated against the Swagger spec for the given operation.
4. handler: Assuming all previous steps pass, the handler is now executed.
5. 

### OAuth2 Security

When your Swagger api specifies one or more OAuth2 [security schemes](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#implicit-oauth2-sample) then routes which opt into one or more of these schemes can be pretected by an authorizer function.

Just like handlers, you can define an authorizer in a file or via a factory.

#### File Authorizer

The file should be named after the security scheme and reside in the directory path defined by the `security` option. It should export a single middleware function to authorize a request.

```javascript
export default function petstore_auth(req, res, next) {
	const token = decodeJsonToken(req.headers.authorization);
	if (hasRequiredScopes(token, req.requiredScopes)) {
		next();
	} else {
		next(new restify.ForbiddenError());
	}
}
```

#### Authorizer Factory

```javascript
import { addRoutes } from 'swagger-routes'

addRoutes(app, {
    api: './api.yml',
    createAuthorizer
})

function createAuthorizer(schemeId, securityScheme) {
    return function authorizer(req, res, next) {
    	const token = decodeJsonToken(req.headers.authorization);
    	if (hasRequiredScopes(token, req.requiredScopes)) {
    		next();
    	} else {
    		next(new restify.ForbiddenError());
    	}
    }
}
```

### Operation Object

An operation object inherits its properties from those defined in the [Swagger spec](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#operationObject).

There are only a few differences / additions.

- `id`: Replaces `operationId`.
- `path`: The route path of this operation.
- `method`: The http method
- `consumes`: Populated with the top level `consumes` unless the operation defines its own.
- `produces`: Populated with the top level `produces` unless the operation defines its own.
- `paramGroupSchemas`: JSON Schema for each param group ('header', 'path', 'query', 'body', 'formData') relevant to the operation.
