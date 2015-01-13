/**
 * Module dependencies.
 */
var util = require('util')
  , OAuth2Strategy = require('passport-oauth').OAuth2Strategy
  , InternalOAuthError = require('passport-oauth').InternalOAuthError;


/**
 * `LinkedinTokenStrategy` constructor.
 *
 * The Linkedin authentication strategy authenticates requests by delegating to
 * Linkedin using the OAuth 2.0 protocol.
 *
 * And accepts only access_tokens. Specialy designed for client-side flow (implicit grant flow)
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      your Linkedin application's App ID
 *   - `clientSecret`  your Linkedin application's App Secret
 *
 * Examples:
 *
 *     passport.use(new LinkedinTokenStrategy({
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function LinkedinTokenStrategy(options, verify) {
  options = options || {}
  options.authorizationURL = options.authorizationURL || 'https://www.linkedin.com';
  options.tokenURL = options.tokenURL || 'https://www.linkedin.com/uas/oauth2/accessToken';
  options.scopeSeparator = options.scopeSeparator || ',';

  this._passReqToCallback = options.passReqToCallback;

  OAuth2Strategy.call(this, options, verify);
  this.profileUrl = options.profileURL || 'https://api.linkedin.com/v1/people/~:(id,first-name,last-name,email-address,public-profile-url)?format=json';
  this.name = 'linkedin-token';
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(LinkedinTokenStrategy, OAuth2Strategy);

/**
 * Authenticate request by delegating to a service provider using OAuth 2.0.
 *
 * @param {Object} req
 * @api protected
 */
LinkedinTokenStrategy.prototype.authenticate = function(req, options) {
  options = options || {};
  var self = this;

  if (req.query && req.query.error) {
    return this.fail();
  }

  // req.body may not be present, but token may be present in querystring
  var accessToken,refreshToken;
  if(req.body){
    accessToken = req.body.access_token;
    refreshToken = req.body.refresh_token;
  }

  accessToken = accessToken || req.query.access_token || req.headers.access_token;
  refreshToken = refreshToken || req.query.refresh_token || req.headers.refresh_token;

  if (!accessToken) { return this.fail(); }

  self._loadUserProfile(accessToken, function(err, profile) {
    if (err) { return self.fail(err); };

    function verified(err, user, info) {
      if (err) { return self.error(err); }
      if (!user) { return self.fail(info); }
      self.success(user, info);
    }

    if (self._passReqToCallback) {
      self._verify(req, accessToken, refreshToken, profile, verified);
    } else {
      self._verify(accessToken, refreshToken, profile, verified);
    }
  });
}

LinkedinTokenStrategy.prototype.authorizationParams = function(options) {

  var params = {};

  // LinkedIn requires state parameter. It will return an error if not set.
  if (options.state) {
    params['state'] = options.state;
  }
  return params;
}

/**
 * Retrieve user profile from Linkedin.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         always set to `Linkedin`
 *   - `id`               the user's Linkedin ID
 *   - `username`         the user's Linkedin username
 *   - `displayName`      the user's full name
 *   - `name.familyName`  the user's last name
 *   - `name.givenName`   the user's first name
 *   - `name.middleName`  the user's middle name
 *   - `gender`           the user's gender: `male` or `female`
 *   - `profileUrl`       the URL of the profile for the user on Linkedin
 *   - `emails`           the proxied or contact email address granted by the user
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
LinkedinTokenStrategy.prototype.userProfile = function(accessToken, done) {

  //LinkedIn uses a custom name for the access_token parameter
  this._oauth2.setAccessTokenName("oauth2_access_token");

  this._oauth2.get(this.profileUrl, accessToken, function (err, body, res) {
    if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

    try {
      var json = JSON.parse(body);

      var profile = { provider: 'linkedin' };

      profile.id = json.id;
      profile.displayName = json.formattedName;
      profile.name = {
        familyName: json.lastName,
        givenName:  json.firstName
      };
      profile.emails = [{ value: json.emailAddress }];
      profile.photos = [];
      if (json.pictureUrl) {
        profile.photos.push(json.pictureUrl);
      }
      profile._raw = body;
      profile._json = json;

      done(null, profile);
    } catch(e) {
      done(e);
    }
  });
}

/**
 * Load user profile, contingent upon options.
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api private
 */
LinkedinTokenStrategy.prototype._loadUserProfile = function(accessToken, done) {
  var self = this;

  function loadIt() {
    return self.userProfile(accessToken, done);
  }
  function skipIt() {
    return done(null);
  }

  if (typeof this._skipUserProfile == 'function' && this._skipUserProfile.length > 1) {
    // async
    this._skipUserProfile(accessToken, function(err, skip) {
      if (err) { return done(err); }
      if (!skip) { return loadIt(); }
      return skipIt();
    });
  } else {
    var skip = (typeof this._skipUserProfile == 'function') ? this._skipUserProfile() : this._skipUserProfile;
    if (!skip) { return loadIt(); }
    return skipIt();
  }
}

/**
 * Expose `LinkedinTokenStrategy`.
 */
module.exports = LinkedinTokenStrategy;
