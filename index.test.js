/** 
 * @module netlify-functions-session-cookie
 * @author Matteo Cargnelutti
 * @license MIT
 * @file index.test.js
 */

//------------------------------------------------------------------------------
// Imports
//------------------------------------------------------------------------------
const rewire = require("rewire");

const lib = rewire('./index.js');
const withSession = lib.__get__('withSession');
const getSession = lib.__get__('getSession');
const clearSession = lib.__get__('clearSession');
const generateSecretKey = lib.__get__('generateSecretKey');
const getCookieName = lib.__get__('getCookieName');
const getCookieOptions = lib.__get__('getCookieOptions');
const getSecretKey = lib.__get__('getSecretKey');
const SIGNATURE_DIGEST_LENGTH = lib.__get__('SIGNATURE_DIGEST_LENGTH');
const SESSION_COOKIE_NAME_DEFAULT = lib.__get__('SESSION_COOKIE_NAME_DEFAULT');
const SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT = lib.__get__('SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT');

//------------------------------------------------------------------------------
// Environment variable mocks
//------------------------------------------------------------------------------
const SESSION_COOKIE_NAME = {
  valid: ['session-cookie', 'FOOBAR42', '!!__'],
  invalid: ['', ' ', 'session cookie', 'séssion', 'çćàâò']
}

const SESSION_COOKIE_SECRET = {
  valid: '1bWrwcr5sRn+4pJwYboqazGUjcBy8YV5i7VDwKfcXZk=',
  invalid: 'tooshort'
}

//------------------------------------------------------------------------------
// Setup / Teardown
//------------------------------------------------------------------------------
/**
 * Keep a copy of environment variables before the tests run, so we can alter them on the fly safely.
 */
const ENV_BUFFER = process.env;

/**
 * Before each test:
 * - Create a fresh "burner" copy of `process.env` using `ENV_BUFFER`
 * - Pass ref to `process.env` to the library via rewire's __set__, so it can be read and edited
 */
beforeEach(() => {
  process.env = Object.assign({}, ENV_BUFFER);
  lib.__set__('process.env', process.env);
});

/**
 * After all tests are run:
 * - Restore `process.env` to its original state
 */
afterAll(() => {
  process.env = ENV_BUFFER;
});

//------------------------------------------------------------------------------
// Test suites
//------------------------------------------------------------------------------
describe('Test suite for the `withSession()` function:', () => {

  test('Throws when given anything else than an async function', () => {
    for (let value of [{}, [], 'foo', () => true]) {
      expect( () => withSession(value)).toThrow();
    }
  });

  test('Binds given async function to `sessionWrapper()`:', async () => {
    // Test will succeed if: function returned by `withSession()` executed `handler` as it ran.
    // We make sure of that by having `handler` modify a flag as it runs.
    const flags = { 
      handlerRan: false
    }

    async function handler(event, context) {
      flags.handlerRan = true;
      return {};
    }

    const event = {};
    const context = { clientContext: {}};

    process.env.SESSION_COOKIE_SECRET = SESSION_COOKIE_SECRET.valid;

    await withSession(handler)(event, context);

    expect(flags.handlerRan).toBe(true);
  });

});

describe('Test suite for the `getSession()` function:', () => {

  test('Throws unless given a suitable `context` object as an argument.', () => {
    for (let value of [{}, "", [], 12, {foo: 12}]) {
      expect(() => getSession(value)).toThrow();
    }
  });

  test('Creates `context.clientContext.sessionCookieData` if needed.', () => {
    const context = {clientContext: {}};
    getSession(context);
    expect('sessionCookieData' in context.clientContext).toBe(true);
  });

  test('Returns a reference to `context.clientContext.sessionCookieData`.', () => {
    const context = {clientContext: {}};
    const session = getSession(context);
    expect(session === context.clientContext.sessionCookieData).toBe(true);
  });

});

describe('Test suite for the `clearSession()` function:', () => {

  test('Empties `context.clientContext.sessionCookieData`.', () => {

    // Initialize a `context.clientContext.sessionCookieData` object.
    const context = {clientContext: {}};

    const session = getSession(context);
    session.foo = 'bar';
    session.lorem = 'ipsum';

    // Check that it clears.
    clearSession(context);
    expect(Object.keys(session).length).toBe(0);
  });

});

describe('Test suite for the `generateSecretKey()` function:', () => {

  test('Returns a 32-byte-long random key.', () => {
    let previousKeys = {}; // Keep track of previously generated keys to check for uniqueness.

    for (let i = 0; i < 10; i++) {
      let key = generateSecretKey();
      let keyLength = Buffer.byteLength(key, 'base64');

      // Key must be 32 bytes long
      expect(keyLength).toBe(32);

      // Key must be unique
      expect(key in previousKeys).toBe(false);
      previousKeys[key] = true;
    }
  });

});

describe('Test suite for the `sessionWrapper()` function:', () => {
  // These flags will be switched by `handler` as it is executed by `sessionWrapper()`.
  const flags = {
    handlerIsGivenSessionObject: false,
    sessionCookieIsParsed: false,
  };

  // Data to be stored in the session cookie.
  const toStore = {
    foo: 'bar',
    lorem: 'ipsum'
  };

  // Event and context to be passed to the handler function
  const event = {};
  
  const context = {
    clientContext: {}
  };

  // Mock of a lambda function handler, simulating read / write of session data.
  async function handler(event, context) {

    const session = getSession(context);

    // Check that `session` object exists
    if (session !== null && session !== undefined) {
      flags.handlerIsGivenSessionObject = true;
    }

    // If a session cookie was parsed into an object, check its integrity (compare to `toStore`).
    if (session && Object.keys(session).length > 0) {
      flags.sessionCookieIsParsed = true;

      for (let key of Object.keys(toStore)) {
        if (toStore[key] !== session[key]) {
          flags.sessionCookieIsParsed = false;
        }
      }
    }

    // Add entries from `toStore` to session on each call.
    for (let [key, value] of Object.entries(toStore)) {
      session[key] = value;
    }

    // Additional `Set-Cookie` headers are added to the mock response:
    // This allows us to make sure `sessionWrapper()` doesn't erase them.
    return {
      headers: {
        'Set-Cookie': 'another-cookie=12'
      },
      multiValueHeaders: {
        'Set-Cookie': ['and-another-one=42']
      }
    };
  }

  test('Runs complete session lifecycle (read, write, signature validation).', async() => {
    let response = null;
    let validCookie = null;
    let alteredCookie = null;

    process.env.SESSION_COOKIE_SECRET = SESSION_COOKIE_SECRET.valid;

    //
    // [1] First run: 
    // - Check that the handler function has access to session data.
    // - Check that a session cookie is being returned in response.
    // - Ensure that the session cookie didn't erase any other `Set-Cookie` header. 
    //
    response = await withSession(handler)(event, context);
    expect(flags.handlerIsGivenSessionObject).toBe(true);
    expect(flags.sessionCookieIsParsed).toBe(false);

    // 2 other cookies were set.
    expect(response.multiValueHeaders['Set-Cookie'].length).toBe(3);

    // The last of the 3 cookies should be our `session` cookie.
    expect(response.multiValueHeaders['Set-Cookie'][2]).toMatch(`${getCookieName()}=`);

    //
    // [2] Second run:
    // - Check that `handler` writes and parses the session cookie correctly.
    //
    // Grab session cookie from last response.
    validCookie = response.multiValueHeaders['Set-Cookie'][2];
    validCookie = validCookie.split(';')[0];
    event.multiValueHeaders = { 'Cookie': [validCookie] };

    response = await withSession(handler)(event, context);
    expect(flags.sessionCookieIsParsed).toBe(true);

    //
    // [3] Third run:
    // - Ensure that session cookie is not parsed if it was tampered with.
    //
    alteredCookie = event.multiValueHeaders['Cookie'][0].substring(0, SIGNATURE_DIGEST_LENGTH); // Signature
    alteredCookie += encodeURIComponent(Buffer.from('"oh noes"').toString('base64')); // New payload
    event.multiValueHeaders['Cookie'][0] = alteredCookie;

    clearSession(context);
    flags.sessionCookieIsParsed = false;

    response = await withSession(handler)(event, context);
    expect(flags.sessionCookieIsParsed).toBe(false);

    //
    // [4] Fourth run:
    // - Ensure that session cookie is not parsed if secret key changed.
    //
    event.multiValueHeaders['Cookie'][0] = validCookie;
    process.env.SESSION_COOKIE_SECRET = generateSecretKey();

    clearSession(context);
    flags.sessionCookieIsParsed = false;

    response = await withSession(handler)(event, context);
    expect(flags.sessionCookieIsParsed).toBe(false);

  });

});

describe('Test suite for the `getCookieName()` function:', () => {

  test('Returns default name if `env.SESSION_COOKIE_NAME` is not set.', () => {
    const name = getCookieName();
    expect(name).toBe(SESSION_COOKIE_NAME_DEFAULT);
  });

  test('If set, `env.SESSION_COOKIE_NAME` can only contain ASCII characters and no whitespace.', () => {
    for (let name of SESSION_COOKIE_NAME.valid) {
      process.env.SESSION_COOKIE_NAME = name;
      expect(getCookieName()).toBe(name);
    }

    for (let name of SESSION_COOKIE_NAME.invalid) {
      process.env.SESSION_COOKIE_NAME = name;
      expect(() => getCookieName()).toThrow();
    }
  });

});

describe('Test suite for the `getCookieName()` function:', () => {

  test('Returns default name if `env.SESSION_COOKIE_NAME` is not set.', () => {
    delete process.env.SESSION_COOKIE_NAME;
    const name = getCookieName();
    expect(name).toBe(SESSION_COOKIE_NAME_DEFAULT);
  });

  test('If set, `env.SESSION_COOKIE_NAME` can only contain ASCII chars and no whitespace.', () => {
    for (let name of SESSION_COOKIE_NAME.valid) {
      process.env.SESSION_COOKIE_NAME = name;
      expect(getCookieName()).toBe(name);
    }

    for (let name of SESSION_COOKIE_NAME.invalid) {
      process.env.SESSION_COOKIE_NAME = name;
      expect(() => getCookieName()).toThrow();
    }
  });

});


describe('Test suite for the `getSecretKey()` function:', () => {

  test('Throws if `env.SESSION_COOKIE_SECRET` is not set or less than 32 bytes long.', () => {
    // No key provided
    delete process.env.SESSION_COOKIE_SECRET;
    expect(() => getSecretKey()).toThrow();

    // Key provided is less than 32 bytes long
    process.env.SESSION_COOKIE_SECRET = SESSION_COOKIE_SECRET.invalid;
    expect(() => getSecretKey()).toThrow();
  });

  test('Returns the value of `env.SESSION_COOKIE_SECRET` if set and valid.', () => {
    process.env.SESSION_COOKIE_SECRET = SESSION_COOKIE_SECRET.valid;
    const secret = getSecretKey();
    expect(secret).toBe(SESSION_COOKIE_SECRET.valid);
  });

});

describe('Test suite for the `getCookieOptions()` function:', () => {

  test('`httpOnly` is present and `true` unless `env.SESSION_COOKIE_HTTPONLY` is "0".', () => {
    let options = null;

    // `env.SESSION_COOKIE_HTTPONLY` not set: `httpOnly` = true
    delete process.env.SESSION_COOKIE_HTTPONLY;
    options = getCookieOptions();
    expect(options.httpOnly).toBe(true);

    // `env.SESSION_COOKIE_HTTPONLY` not "0": `httpOnly` = true
    process.env.SESSION_COOKIE_HTTPONLY = 'FOO';
    options = getCookieOptions();
    expect(options.httpOnly).toBe(true);

    // `env.SESSION_COOKIE_HTTPONLY` is "0": `httpOnly` skipped
    process.env.SESSION_COOKIE_HTTPONLY = '0';
    options = getCookieOptions();
    expect('httpOnly' in options).toBe(false);

  });

  test('`secure` is present and `true` unless `env.SESSION_COOKIE_SECURE` is "0".', () => {
    let options = null;

    // `env.SESSION_COOKIE_SECURE` not set: `secure` = true
    delete process.env.SESSION_COOKIE_SECURE;
    options = getCookieOptions();
    expect(options.secure).toBe(true);

    // `env.SESSION_COOKIE_SECURE` not "0": `secure` = true
    process.env.SESSION_COOKIE_SECURE = 'FOO';
    options = getCookieOptions();
    expect(options.secure).toBe(true);

    // `env.SESSION_COOKIE_SECURE` is "0": `secure` skipped
    process.env.SESSION_COOKIE_SECURE = '0';
    options = getCookieOptions();
    expect('secure' in options).toBe(false);

  });

  test('`sameSite` is "lax" unless specified otherwise via `env.SESSION_COOKIE_SAMESITE`.', () => {
    let options = null;

    // `env.SESSION_COOKIE_SAMESITE` not set: `sameSite` = "lax"
    delete process.env.SESSION_COOKIE_SAMESITE;
    options = getCookieOptions();
    expect(options.sameSite).toBe("lax");

    // `env.SESSION_COOKIE_SAMESITE` is passed and valid: `sameSite` = value
    for (let value of ['Lax', 'Strict', 'None']) {
      process.env.SESSION_COOKIE_SAMESITE = value;
      options = getCookieOptions();
      expect(options.sameSite).toBe(value.toLowerCase());
    }

    // `env.SESSION_COOKIE_SAMESITE` is passed but invalid: `sameSite` = "lax"
    process.env.SESSION_COOKIE_SAMESITE = 'FOO';
    options = getCookieOptions();
    expect(options.sameSite).toBe("lax");
  });

  test('`maxAge` has a default unless specified otherwise via `env.SESSION_COOKIE_MAX_AGE_SPAN`.', () => {
    let options = null; 

    // `env.SESSION_COOKIE_MAX_AGE` not set: `maxAge` = SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT
    delete process.env.SESSION_COOKIE_MAX_AGE_SPAN;
    options = getCookieOptions();
    expect(options.maxAge).toBe(SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT); 

    // `env.SESSION_COOKIE_MAX_AGE` set but NaN: `maxAge` = SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT
    process.env.SESSION_COOKIE_MAX_AGE_SPAN = 'FOO';
    options = getCookieOptions();
    expect(options.maxAge).toBe(SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT); 

    // `env.SESSION_COOKIE_MAX_AGE` set and valid: `maxAge` = value
    process.env.SESSION_COOKIE_MAX_AGE_SPAN = 2048;
    options = getCookieOptions();
    expect(options.maxAge).toBe(2048); 
  });

  test('`domain` is not present unless specified otherwise via `env.SESSION_COOKIE_DOMAIN`.', () => {
    let options = null;

    // `env.SESSION_COOKIE_DOMAIN` not set: `domain` skipped
    delete process.env.SESSION_COOKIE_DOMAIN;
    options = getCookieOptions();
    expect('domain' in options).toBe(false);
    
    // `env.SESSION_COOKIE_DOMAIN` is set: `domain` = value
    process.env.SESSION_COOKIE_DOMAIN = 'netlify.app';
    options = getCookieOptions();
    expect(options.domain).toBe('netlify.app');
  });

  test('`path` is "/" unless specified otherwise via `env.SESSION_COOKIE_PATH`.', () => {
    let options = null;

    // `env.SESSION_COOKIE_PATH` not set: `path` = "/"
    delete process.env.SESSION_COOKIE_PATH;
    options = getCookieOptions();
    expect(options.path).toBe("/");
    
    // `env.SESSION_COOKIE_PATH` is set: `path` = value
    process.env.SESSION_COOKIE_PATH = '/some/path';
    options = getCookieOptions();
    expect(options.path).toBe('/some/path');
  });

});
