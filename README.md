# netlify-functions-session-cookie 🍪
Cryptographically-signed session cookies for [Netlify functions](https://docs.netlify.com/functions/overview/).

---

## Summary 
- [Install](#Install)
- [Concept and Usage](#concept-and-usage)
- [API](#api)
- [Environment variables and options](#environment-variables-and-options)
- [Generating a secret key](#generating-a-secret-key)
- [Notes and misc](#notes-and-misc)
- [Contributing](#contributing)

---

## Install

```bash
npm install netlify-functions-session-cookie
```

⚠️ This library requires a **secret key** to sign and verify cookies. 
See [_"Generating a secret key"_](#generating-a-secret-key).

[☝️ Back to summary](#summary)

---

## Concept and usage
This library automatically manages a cryptographically-signed cookie that can be used to store data for a given client across requests.  Signed cookies are an efficient way of storing data on the client side while preventing tampering. 

**It takes inspiration from [Flask's default session system](https://flask.palletsprojects.com/en/2.0.x/quickstart/#sessions) and behaves in a similar way:** 
- **At handler level:** gives access to a standard object which can be used to read and write data to and from the session cookie for the current client.
- **Behind the scenes:** the session cookie is automatically verified and parsed on the way in, signed and serialized on the way out.

Simply wrap a Netlify Function handler with `withSession()` to get started. 

### Example: visits counter for a given user
```javascript
const { withSession, getSession } = require('netlify-functions-session-cookie');

exports.handler = withSession(async function(event, context) {

  const session = getSession(context);

  if ('visits' in session) {
    session.visits += 1;
  }
  else {
    session.visits = 1;
  }

  return {
    statusCode: 200,
    body: `You've visited this endpoint ${session.visits} time(s)`
  }
  
});
```

The `Set-Cookie` header is automatically added to the response object to include a serialized and signed version of the session object:

```javascript
// `response` object
{
  statusCode: 200,
  body: "You've visited this endpoint 11 time(s)",
  multiValueHeaders: {
    'Set-Cookie': [
      'session=6tHCcUCghDUKwOMU3ZNWRYTaQZfde-dxgoDkLpjG26QeyJ2aXNpdHMiOjExfQ%3D%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax'
    ]
  }
}
```

> **Note:** Existing `Set-Cookie` entries in `response.headers` or `response.multiValueHeaders` are preserved and merged into `response.multiValueHeaders`. 

The cookie's attributes can be configured individually using [environment variables](#environment-variables-and-options).


[☝️ Back to summary](#summary)

---

## API

### withSession(handler: AsyncFunction)
Takes a [synchronous Netlify Function handler](https://docs.netlify.com/functions/build-with-javascript/#synchronous-function-format) as an argument and returns it wrapped with [`sessionWrapper()`](https://github.com/matteocargnelutti/netlify-functions-session-cookie/blob/main/index.js#:~:text=function%20sessionWrapper), which handles the session cookie in and out. 

See [_"Concept and Usage"_](#concept-and-usage) for more information.

```javascript
const { withSession } = require('netlify-functions-session-cookie');

exports.handler = withSession(async function(event, context) {
  // ...
});

// Alternatively: 
async function(event, context) {
  // ...
}
exports.handler = withSession(handler); 

```

### getSession(context: Object)
`getSession()` takes a `context` object from a Netlify Function handler as an argument a returns a reference to `context.clientContext.sessionCookieData`, which is where parsed session data live.

If `context.clientContext.sessionCookieData` doesn't exist, it is going to be created on the fly.

```javascript
const { withSession } = require('netlify-functions-session-cookie');

exports.handler = withSession(async function(event, context) {
  const session = getSession(context); 
  // `session` can now be used to read and write data from the session cookie.
  // ...
});
```

### clearSession(context: Object)
As the session object is passed to the Netlify Functions handler by reference, it is not possible to empty by simply replacing it by an new object:

```javascript
exports.handler = withSession(async function(event, context) {
  let session = getSession(context);
  session = {}; // This will NOT clear session data.
  // ...
}
```

You may instead use the `clearSession()` function to do so. This function takes the Netlify Functions handler `context` object as an argument.

```javascript
const { withSession, getSession, clearSession } = require('netlify-functions-session-cookie');

async function handler(event, context) {

  const session = getSession(session);
  clearSession(session); // Will clear the session object in place.

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Session cookie cleared." }),
  };
  
}
exports.handler = withSession(handler);
```

### generateSecretKey()
Generates and returns a 32-byte-long random key, encoded in base64.
See [_"Generating a secret key"_](#generating-a-secret-key).

[☝️ Back to summary](#summary)

---

## Environment variables and options

The session cookie can be configured through environment variables.

### Required
| Name | Description |
| --- | --- |
| `SESSION_COOKIE_SECRET` | Used to sign and validate the session cookie. Must be at least 32 bytes long. See [_"Generating a secret key"_](#generating-a-secret-key) for more information. |

### Optional
| Name | Description |
| --- | --- |
| `SESSION_COOKIE_NAME` | Name used by the session cookie. Must only contain ASCII-compatible characters and no whitespace. Defaults to `"session"`. |
| `SESSION_COOKIE_HTTPONLY` | The session cookie bears the `HttpOnly` attribute by default. Set this environment variable to `"0"` to remove it. | 
| `SESSION_COOKIE_SECURE` | The session cookie bears the `Secure` attribute by default. Set this environment variable to `"0"` to remove it. | 
| `SESSION_COOKIE_SAMESITE` | Can be `"Strict"`, `"None"` or `"Lax"`. Defaults to `"Lax"` if not set. | 
| `SESSION_COOKIE_MAX_AGE_SPAN` | Specifies, in second, how long the cookie should be valid for. Defaults to `604800` _(7 days)_ if not set. |
| `SESSION_COOKIE_DOMAIN` | Can be used to specify a domain for the session cookie. |
| `SESSION_COOKIE_PATH` | Can be used to specify a path for the session cookie. Defaults to `/` if not set. |

[☝️ Back to summary](#summary)

---

## Generating a secret key

Session cookies are signed using [HMAC SHA256](https://en.wikipedia.org/wiki/HMAC), which requires using a secret key of at least 32 bytes of length.
This one-liner can be used to generate a random key, once the library is installed:

```bash
node -e "console.log(require('netlify-functions-session-cookie').generateSecretKey())"
```

Use the [`SESSION_COOKIE_SECRET` environment variable](#environment-variables-and-options) to give the library access to the secret key.

[☝️ Back to summary](#summary)

---

## Notes and misc

### Not affiliated with Netlify
This open-source project is not affiliated with [Netlify](https://www.netlify.com/).

### Usage with other AWS Lambda setups
This library has been built for use with [Netlify Functions](https://docs.netlify.com/functions/build-with-javascript/), but could in theory work with other setups using AWS Lambda functions. 

[☝️ Back to summary](#summary)

---

## Contributing

> Work in progress 🚧. 
> **In the meantime:** Please feel free to open [issues](https://github.com/matteocargnelutti/netlify-functions-session-cookie/issues) to report bugs, suggest features, or offer to contribute to this project.

[☝️ Back to summary](#summary)