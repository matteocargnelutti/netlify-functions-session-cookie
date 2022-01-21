> Work in progress 🚧

# netlify-functions-session-cookie 🍪
Cryptographically-signed session cookies for Netlify functions.

Inspired by [Flask's default session system](https://flask.palletsprojects.com/en/2.0.x/quickstart/#sessions), focus on ease of use and zero-config approach. 

---

## Summary 
- [Install](#Install)
- [Concept and Usage](#concept-and-usage)
- [API](#api)
- [Environment variables](#environment-variables)
- [Generating a secret key](#generating-a-secret-key)
- [Notes and disclaimers](#notes-and-disclaimers)
- [Contributing](#contributing)

---

## Install

```bash
npm install netlify-functions-session-cookie
```

[☝️ Back to summary](#summary)

---

> To rework entirely.

## Concept and usage

Automatically manages a cryptographically-signed cookie than can be used to store session data for a given user.

This library was inspired by [Flask's default session system](https://flask.palletsprojects.com/en/2.0.x/quickstart/#sessions) and behaves in a fairly similar way: 
- **At function-level:** Data can be read and write from a simple, shared session data object.
- **Behind the scenes:** The library automatically reads and writes from the session cookie, which is cryptographically signed using HMAC-SHA256 to prevent tampering from the client. 


### Example: Count visits of a given user

```javascript
const { withSession, getSession } = require('netlify-functions-session-cookie');

async function handler(event, context) {

  const session = getSession(context);

  if ('visits' in session) {
    session.visits += 1;
  }
  else {
    session.visits = 1;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ visits: session.visits }),
  };
  
}
exports.handler = withSession(handler);
```

The `Set-Cookie` header is automatically  added to the `response` object by `withSession()` to include a serialized and signed version of the `session` object: 

```javascript
// `response` object
{
  statusCode: 200,
  body: '{"visits":1}',
  multiValueHeaders: {
    'Set-Cookie': [
      'session=b-v3l87SbkttQWjbVgOusC9uesdVsRvWVqEcSuNkZBkeyJ2aXNpdHMiOjF9; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax'
    ]
  }
}
```

The cookie in itself is made of **the signature and the data contained in the session obect**.
⚠️ Data is **not encrypted, but signed**. It can be read, but not modified by the client without the secret key. 

```
set-cookie: session=b-v3l87SbkttQWjbVgOusC9uesdVsRvWVqEcSuNkZBkeyJ2aXNpdHMiOjF9; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax
```

[☝️ Back to summary](#summary)

---

## API

### withSession(handler: AsyncFunction)
> TO DO: Fix now that `clearSession` expects a context object

Takes a [synchronous Netlify Function handler](https://docs.netlify.com/functions/build-with-javascript/#synchronous-function-format) as an argument and returns a new version of it, now with automatic session cookie management.

See [Concept and usage](#concept-and-usage) for more information.

```javascript
const { withSession, getSession } = require('netlify-functions-session-cookie');

// Default syntax:
async function(event, context) {
  const session = getSession(context);
  // ...
}
exports.handler = withSession(handler); 

// Alternative syntax:
exports.handler = withSession(async function(event, context) {
  const session = getSession(context);
  // ...
});
```

### getSession(context: Object)
> TO DO
> Explain how this works (usage of `context` object).

### clearSession(context: Object)
> TO DO: Fix now that `clearSession` expects a context object

As the `session` object is passed to the Netlify Function handler by reference, it cannot be emptied by being replaced by an empty object:

```javascript
session = {}; // This would NOT empty the actual session object.
```

You may instead use the `clearSession()` function to do so.

```javascript
const { withSession, clearSession } = require('netlify-functions-session-cookie');

async function handler(event, context, session) {

  clearSession(session); // Will clear the session object in place.

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Session cookie cleared." }),
  };
  
}
exports.handler = withSession(handler);
```

### generateSecretKey()
Generates and returns a 32-byte-long random key, encoded in base 64.
See [_"Generating a secret key"_](#generating-a-secret-key).

[☝️ Back to summary](#summary)

---

## Environment variables

The session cookie can be configured through environment variables.

### Required
| Name | Description |
| --- | --- |
| `SESSION_COOKIE_SECRET` | Used to sign and validate the cookie. Must be at least 32 bytes long. See [_"Generating a secret key"_](#generating-a-secret-key) for more information. |

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

Session cookies are signed using HMAC-SHA256, which requires a secret key of at least 32 bytes of length.
You may use this one-liner to generate a random key, once the library is installed:

```bash
node -e "console.log(require('netlify-functions-session-cookie').generateSecretKey())"
```

[☝️ Back to summary](#summary)

---

## Notes and disclaimers

### Not affiliated with Netlify
This open-source project is not affiliated with [Netlify](https://www.netlify.com/).

### Usage with other AWS Lambda setups
This library has been built for use with [Netlify Functions](https://docs.netlify.com/functions/build-with-javascript/), but could in theory work with other setups using AWS Lambda functions. 

Testing and maintenance focus will remain on Netlify Functions for the time being.

[☝️ Back to summary](#summary)

---

## Contributing

> TO DO