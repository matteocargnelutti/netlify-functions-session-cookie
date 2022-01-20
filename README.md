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