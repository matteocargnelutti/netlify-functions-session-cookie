> Work in progress 🚧

# netlify-functions-session-cookie 🍪
Cryptographically-signed session cookies for Netlify functions.

Inspired by [Flask's default session system](https://flask.palletsprojects.com/en/2.0.x/quickstart/#sessions). 

---

## Summary 
- [Install](#Install)
- [Concept and Usage](#concept-and-usage)
- [API](#api)
- [Environment variables](#environment-variables)
- [Generating a secret key](#generating-a-secret-key)
- [Notes and disclaimers](#notes-and-disclaimers)

---

## Install

```bash
npm install netlify-functions-session-cookie
```

[☝️ Back to summary](#summary)

---

## Concept and usage

```javascript
const { withSession } = require('netlify-functions-session-cookie');

async function handler(event, context, session) {

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


```javascript
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

```
set-cookie: session=b-v3l87SbkttQWjbVgOusC9uesdVsRvWVqEcSuNkZBkeyJ2aXNpdHMiOjF9; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax
```

[☝️ Back to summary](#summary)

---

## API

### `withSession(AsyncFunction)`


### `clearSession(Object)`
As the `session` object is passed to the Netlify Function handler by reference, it cannot be emptied by being replaced by an empty object:

```javascript
session = {}; // This would NOT empty the actual session object.
```

You may instead use the `clearSession()` function to do so.

```javascript
const { withSession, clearSession } = require('netlify-functions-session-cookie');

async function handler(event, context, session) {

  clearSession(session);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Session cookie cleared." }),
  };
  
}
exports.handler = withSession(handler);
```

### `generateSecretKey()`
Generates and returns a randomly-generated 32-byte-long secret key, encoded in base 64.
See [_"Generating a secret key"_](#generating-a-secret-key).

[☝️ Back to summary](#summary)

---

## Environment variables

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