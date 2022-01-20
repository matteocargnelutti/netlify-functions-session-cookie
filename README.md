> Work in progress 🚧

# netlify-functions-session-cookie 🍪
Cryptographically-signed session cookies for Netlify functions.

Inspired by [Flask's default session system](https://flask.palletsprojects.com/en/2.0.x/quickstart/#sessions). 

---

## Summary 
- [Concept and Usage](#concept-and-usage)
- [API](#api)
- [Environment variables](#environment-variables)
- [Generating a secret key](#generating-a-secret-key)
- [Notes and disclaimers](#notes-and-disclaimers)

---

## Concept and usage

```javascript
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

### `generateSecretKey()`

[☝️ Back to summary](#summary)

---

## Environment variables

| Name | Required? | Description |
| --- | --- | --- |
| `SESSION_COOKIE_SECRET` | **Yes** | Used to sign and validate the cookie. Must be at least 32 bytes long. See [_"Generating a secret key"_](#generating-a-secret-key) |
| `SESSION_COOKIE_NAME` | No | Name used by the session cookie. Must only contain ASCII-compatible characters and no whitespace. Defaults to `"session"`. |
| `SESSION_COOKIE_HTTPONLY` | No | If set to `"0"`, the `HttpOnly` attribute of the cookie will be removed. | 
| `SESSION_COOKIE_SECURE` | No | If set to `"0"`, the `Secure` attribute of the cookie will be skipped. |
| `SESSION_COOKIE_SAMESITE` | No | Can be `"Strict"`, `"None"` or `"Lax"`. Defaults to `"Lax"` if not set. | 
| `SESSION_COOKIE_MAX_AGE_SPAN` | No | Specifies, in second, how long the cookie should be valid for. Defaults to `604800` _(7 days)_ if not set. |
| `SESSION_COOKIE_DOMAIN` | No | Can be used to specify a domain for the session cookie. |
| `SESSION_COOKIE_PATH` | No | Can be used to specify a path for the session cookie. Defaults to `/` if not set. |

[☝️ Back to summary](#summary)

---

## Generating a secret key

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