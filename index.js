/** 
 * @module netlify-functions-session-cookie
 * @author Matteo Cargnelutti
 * @license MIT
 * @file index.js
 * @description Cryptographically-signed session cookies for Netlify Functions.
 */

//------------------------------------------------------------------------------
// Imports
//------------------------------------------------------------------------------
const crypto = require('crypto');
const cookie = require('cookie');
const Keygrip = require('keygrip');

//------------------------------------------------------------------------------
// Module-level constants
//------------------------------------------------------------------------------
/**
 * Name to be used for the session cookie if none provided.
 * @constant
 * @private
 */
const SESSION_COOKIE_NAME_DEFAULT = 'session';

/**
 * Value to be used as a default for the "Max-Age" attribute of the session cookie.
 * @constant
 * @private
 */
const SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT = (60 * 60 * 24 * 7);

/**
 * Length of the signature digest, in characters. 
 * Used to separate signature from data in the raw session cookie.
 * 
 * @constant
 * @private
 */
const SIGNATURE_DIGEST_LENGTH = 43;

//------------------------------------------------------------------------------
// Public functions 
//------------------------------------------------------------------------------
/**
 * Binds a given lambda function handler to the `sessionWrapper()` function.
 * 
 * Usage:
 * `exports.handler = withSession(async function(event, context, session) { ... }`
 * 
 * @param {function} handler - Lambda function handler. Must be async.
 * @returns {function} - Copy of the `sessionWrapper` function bound to the `handler`.
 */
function withSession(handler) {
  if (handler.constructor.name !== "AsyncFunction") {
    throw new Error(`"handler" must be an async function. ${handler.constructor.name} given.`);
  }

  return sessionWrapper.bind(handler);
}


/**
 * Returns a reference to the `context.clientContext.sessionCookieData` object.
 * This object contains data for the current session, which can be read and edited.
 * 
 * @param {Object} context - From the Lambda handler function.
 * @returns {Object} - Reference to the session data object.
 */
function getSession(context) {
  if (!context || !'clientContext' in context) {
    throw new Error('`getSession()` requires a valid Lambda `context` object as an argument.');
  }

  let session = context.clientContext.sessionCookieData;

  // Initialize `sessionCookieData` if it doesn't exist.
  if (session === undefined || session === null) {
    context.clientContext.sessionCookieData = {};
    session = context.clientContext.sessionCookieData;
  }

  return session;
}

/**
 * Utility to help clear out a session object in place from the handler.
 * 
 * @param {Object} context - From the Lambda handler function.
 * @public 
 */
function clearSession(context) {

  const session = getSession(context);

  for (const key in session) {
    delete session[key];
  }
}

/**
 * Generates a 32-byte-long random key that can be used for signing cookies using SHA-256 HMAC.
 * 
 * Thanks to: https://github.com/crypto-utils/keygrip/issues/26
 * 
 * @returns {string} - Random series of 32 bytes encoded in base64.
 * @public
 */
function generateSecretKey() {
  return crypto.randomBytes(32).toString('base64');
}


//------------------------------------------------------------------------------
// Local functions 
//------------------------------------------------------------------------------
/**
 * Main wrapper around the lambda handler function.
 * Automatically manages a cryptographically signed session cookie, in an out. 
 * Gives access to a `session` object, which can be used to access and edit session data.
 * 
 * @param {Object} event - From the Lambda handler function.
 * @param {Object} context - From the Lambda handler function.
 * @this {function} - Lambda function handler. Bound via `withSession`.
 * @returns {Object} - Altered `response` received from `handler`.
 * @private
 */
async function sessionWrapper(event, context) {
  const cookieName = getCookieName();
  const secretKey = new Keygrip([getSecretKey()], 'sha256', 'base64');

  let incomingCookies = null;
  let response = null;

  const session = getSession(context); // Holds the current state of session data.

  //
  // [1] Try to validate and parse current session data from the `Cookie` header.
  // 

  // Grab cookies from header
  if (event.multiValueHeaders && event.multiValueHeaders.Cookie) {
    incomingCookies = event.multiValueHeaders.Cookie;
  }
  if (event.multiValueHeaders && event.multiValueHeaders.cookie) {
    incomingCookies = event.multiValueHeaders.cookie;
  }

  // Parse cookies, if any
  if (incomingCookies) {
    incomingCookies = cookie.parse(incomingCookies[0]);
  }

  // Grab, validate and parse session data from cookie
  if (incomingCookies && incomingCookies[cookieName]) {

    // Signature: first X characters (`SIGNATURE_DIGEST_LENGTH`), stays in base64.
    // Note: Only works because we know that all characters used for signatures are 1 byte long.
    let signature = incomingCookies[cookieName].substring(0, SIGNATURE_DIGEST_LENGTH);

    // Data: everything after the signature. Needs to be decoded from base64.
    let data = incomingCookies[cookieName].substring(SIGNATURE_DIGEST_LENGTH);
    data = Buffer.from(data, 'base64').toString('utf-8');

    // If signature matches, parse data from JSON and put into the `clientContext.session` object.
    if (secretKey.verify(data, signature)) {
      data = JSON.parse(data);
      for (let [key, value] of Object.entries(data)) { // Update in place to preserve `session` ref.
        session[key] = value
      }
    }

  }

  //
  // [2] Give access to session data to the handler as it runs.
  //
  response = await this(event, context);

  //
  // [3] Process response out of the handler to automatically append session data as a signed cookie.
  //

  // Create `Set-Cookie` entry in `response.multiValueHeaders` if not set.
  if (!response.multiValueHeaders) {
    response.multiValueHeaders = {};
  }

  if (!response.multiValueHeaders['Set-Cookie']) {
    response.multiValueHeaders['Set-Cookie'] = [];
  }

  // Merge any value that may be in `headers['Set-Cookie']` to `response.multiValueHeaders['Set-Cookie']`.
  if (response.headers && response.headers['Set-Cookie']) { 
    response.multiValueHeaders['Set-Cookie'].push(response.headers['Set-Cookie']);
    delete response.headers['Set-Cookie'];
  }

  // Sign session data and add it to `Set-Cookie`.
  let sessionAsJSON = JSON.stringify(session);
  let cookieValue = secretKey.sign(sessionAsJSON) + Buffer.from(sessionAsJSON).toString('base64'); // session=[signature][data]

  response.multiValueHeaders['Set-Cookie'].push(
    cookie.serialize(cookieName, cookieValue, getCookieOptions())
  );

  return response;
}

/**
 * Returns the name to be used for the session cookie. 
 * 
 * Defaults to the value of `SESSION_COOKIE_NAME_DEFAULT`.
 * Can be overridden via `env.SESSION_COOKIE_NAME`.
 * Will throw if `SESSION_COOKIE_NAME` is set but contains anything else than ASCII characters (excluding whitespace).
 * 
 * @returns {string} - Name used for the session cookie
 * @private
 */
function getCookieName() {
  let name = SESSION_COOKIE_NAME_DEFAULT;
  const nameFromEnv = process.env.SESSION_COOKIE_NAME;

  // Try to grab session cookie name from `SESSION_COOKIE_NAME` if available.
  if (typeof nameFromEnv == 'string') {
    const regex = /[A-Za-z0-9\!\#\$\%\&\'\*\+\-\.\^\_\`\|\~]+/g;
    const check = nameFromEnv.match(regex);

    if (nameFromEnv.length < 1) {
      throw new Error(`"SESSION_COOKIE_NAME" cannot be an empty string.`);
    }

    if (!check instanceof Array || check[0] !== nameFromEnv) {
      throw new Error(`"SESSION_COOKIE_NAME" must only contain ASCII characters and no whitespace.`);
    }

    name = nameFromEnv;
  }

  return name;
}

/**
 * Builds an option object to be used by the cookie serializer.
 * All options have defaults which can be edited using environment variables.
 * 
 * Environment variables available:
 * - `env.SESSION_COOKIE_HTTPONLY`: 
 *   Specifies if the cookie should have the `HttpOnly` attribute.
 *   Set to "0" to remove this attribute from the cookie definition.
 * - `env.SESSION_COOKIE_SECURE`:
 *   Specifies if the cookie should have the `Secure` attribute.
 *   Set to "0" to remove this attribute from the cookie definition.
 * - `env.SESSION_COOKIE_SAMESITE`:
 *   Will specify the value for the `SameSite` attribute for the cookie.
 *   Can be "Strict", "None" or "Lax" (default).
 * - `env.SESSION_COOKIE_MAX_AGE_SPAN`:
 *   Specifies, in second, how long the cookie should be valid for. 
 *   Defaults to 7 days.
 * - `env.SESSION_COOKIE_DOMAIN`:
 *   If set, will specify a value for the `Domain` attribute for the cookie.
 * - `env.SESSION_COOKIE_PATH`:
 *   If set, will specify a value for the `Path` attribute for the cookie.
 *   Defaults to `/`.
 * 
 * @returns {object} - Options object for `cookie.serialize`
 * @private
 */
function getCookieOptions() {
  // Defaults (options detail: https://github.com/jshttp/cookie#options-1)
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT,
    path: '/'
  }

  //
  // Use environment variables to edit defaults.
  //
  const {
    SESSION_COOKIE_HTTPONLY,
    SESSION_COOKIE_SECURE,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_MAX_AGE_SPAN,
    SESSION_COOKIE_DOMAIN,
    SESSION_COOKIE_PATH
  } = process.env;

  // HttpOnly
  if (SESSION_COOKIE_HTTPONLY === '0') {
    delete options.httpOnly;
  }

  // Secure
  if (SESSION_COOKIE_SECURE === '0') {
    delete options.secure;
  }

  // SameSite
  if (['Strict', 'Lax', 'None'].includes(SESSION_COOKIE_SAMESITE)) {
    options.sameSite = SESSION_COOKIE_SAMESITE.toLowerCase();
  }

  // Max-Age
  if (!isNaN(parseInt(SESSION_COOKIE_MAX_AGE_SPAN))) {
    options.maxAge = parseInt(SESSION_COOKIE_MAX_AGE_SPAN);
  }

  // Domain
  if (SESSION_COOKIE_DOMAIN) {
    options.domain = SESSION_COOKIE_DOMAIN;
  }

  // Path
  if (SESSION_COOKIE_PATH) {
    options.path = SESSION_COOKIE_PATH;
  }

  return options;
}

/**
 * Checks and returns the secret key to be used to sign the session cookie.
 * Reads from `env.SESSION_COOKIE_SECRET`. 
 * The key must be at least 32 bytes long.
 * 
 * @returns {string} - Key to be used to sign cookies
 * @private
 */
function getSecretKey() {
  let secret = process.env.SESSION_COOKIE_SECRET;
  let secretLength = 0;

  if (!secret || !secret instanceof String) {
    throw new Error(`"SESSION_COOKIE_SECRET": No secret key provided.`);
  }

  secretLength = Buffer.byteLength(secret, 'utf-8');
  if (secretLength < 32) {
    throw new Error(`"SESSION_COOKIE_SECRET": The secret key must be at least 32 bytes long (${secretLength} given).`);
  }

  return secret;
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------
module.exports = {
  withSession,
  getSession,
  clearSession,
  generateSecretKey
}
