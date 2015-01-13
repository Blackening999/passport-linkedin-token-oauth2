/**
 * Module dependencies.
 */
var util = require('util')
  , uri = require('url')
  , crypto = require('crypto')
  , OAuth2Strategy = require('passport-oauth').OAuth2Strategy
  , InternalOAuthError = require('passport-oauth').InternalOAuthError;


/**
 * `LinkedinTokenStrategy` constructor.
 *
 * The Facebook authentication strategy authenticates requests by delegating to
 * Facebook using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      your Facebook application's App ID
 *   - `clientSecret`  your Facebook application's App Secret
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
  this._profileURL = options.profileURL || 'https://api.linkedin.com/v1/people/~:(id,first-name,last-name,public-profile-url)?format=json';
  this.name = 'linkedin-token';
  this._clientSecret = options.clientSecret;
  this._enableProof = options.enableProof;
  this.profileUrl = 'https://api.linkedin.com/v1/people/~:(' + this._convertScopeToUserProfileFields(options.scope, options.profileFields) + ')';
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
    // TODO: Error information pertaining to OAuth 2.0 flows is encoded in the
    //       query parameters, and should be propagated to the application.
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

  if (!accessToken) {
    return this.fail();
  }

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

LinkedinTokenStrategy.prototype._convertScopeToUserProfileFields = function(scope, profileFields) {
  var self = this;
  var map = {
    'r_basicprofile':   [
      'id',
      'first-name',
      'last-name',
      'picture-url',
      'formatted-name',
      'maiden-name',
      'phonetic-first-name',
      'phonetic-last-name',
      'formatted-phonetic-name',
      'headline',
      'location:(name,country:(code))',
      'industry',
      'distance',
      'relation-to-viewer:(distance,connections)',
      'current-share',
      'num-connections',
      'num-connections-capped',
      'summary',
      'specialties',
      'positions',
      'site-standard-profile-request',
      'api-standard-profile-request:(headers,url)',
      'public-profile-url'
    ],
    'r_emailaddress':   ['email-address'],
    'r_fullprofile':   [
      'last-modified-timestamp',
      'proposal-comments',
      'associations',
      'interests',
      'publications',
      'patents',
      'languages',
      'skills',
      'certifications',
      'educations',
      'courses',
      'volunteer',
      'three-current-positions',
      'three-past-positions',
      'num-recommenders',
      'recommendations-received',
      'mfeed-rss-url',
      'following',
      'job-bookmarks',
      'suggestions',
      'date-of-birth',
      'member-url-resources:(name,url)',
      'related-profile-views',
      'honors-awards'
    ]
  };

  var fields = [];

  // To obtain pre-defined field mappings
  if(Array.isArray(scope) && profileFields === null)
  {
    if(scope.indexOf('r_basicprofile') === -1){
      scope.unshift('r_basicprofile');
    }

    scope.forEach(function(f) {
      if (typeof map[f] === 'undefined') return;

      if (Array.isArray(map[f])) {
        Array.prototype.push.apply(fields, map[f]);
      } else {
        fields.push(map[f]);
      }
    });
  }else if (Array.isArray(profileFields)){
    fields = profileFields;
  }

  return fields.join(',');
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
 * Retrieve user profile from Facebook.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         always set to `facebook`
 *   - `id`               the user's Facebook ID
 *   - `username`         the user's Facebook username
 *   - `displayName`      the user's full name
 *   - `name.familyName`  the user's last name
 *   - `name.givenName`   the user's first name
 *   - `name.middleName`  the user's middle name
 *   - `gender`           the user's gender: `male` or `female`
 *   - `profileUrl`       the URL of the profile for the user on Facebook
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

LinkedinTokenStrategy.prototype._convertProfileFields = function(profileFields) {
  var map = {
    'id':          'id',
    'username':    'username',
    'displayName': 'name',
    'name':       ['last_name', 'first_name', 'middle_name'],
    'gender':      'gender',
    'profileUrl':  'link',
    'emails':      'email',
    'photos':      'picture'
  };

  var fields = [];

  profileFields.forEach(function(f) {
    // return raw Facebook profile field to support the many fields that don't
    // map cleanly to Portable Contacts
    if (typeof map[f] === 'undefined') { return fields.push(f); };

    if (Array.isArray(map[f])) {
      Array.prototype.push.apply(fields, map[f]);
    } else {
      fields.push(map[f]);
    }
  });

  return fields.join(',');
};


/**
 * Expose `LinkedinTokenStrategy`.
 */
module.exports = LinkedinTokenStrategy;
