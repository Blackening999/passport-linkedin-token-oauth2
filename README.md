# Passport-Linkedin-Token-OAuth2

[Passport](http://passportjs.org/) strategy for authenticating with [Linkedin](http://www.linkedin.com/)
access tokens using the OAuth 2.0 API.

This module lets you authenticate using Linkedin in your Node.js applications.
By plugging into Passport, Linkedin authentication can be easily and
unobtrusively integrated into any application or framework that supports
[Connect](http://www.senchalabs.org/connect/)-style middleware, including
[Express](http://expressjs.com/).

P.S. The special use case for this library is to use with [ember-cli-simple-auth-torii](https://github.com/simplabs/ember-cli-simple-auth-torii),
are very similar to [passport-facebook-token](https://github.com/drudge/passport-facebook-token).
There is a passport-linkedin-token exists which isn't worked with OAuth2 and can't get user keeping client-side flow.

## Installation

    $ npm install passport-linkedin-token-oauth2

## Usage

#### Configure Strategy

The Linkedin authentication strategy authenticates users using a Linkedin
account and OAuth 2.0 tokens.  The strategy requires a `verify` callback, which
accepts these credentials and calls `done` providing a user, as well as
`options` specifying a app ID and app secret.

```js
passport.use(new LinkedinTokenStrategy({
    clientID: LINKEDIN_APP_ID,
    clientSecret: LINKEDIN_APP_SECRET
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({ linkedinId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));
```

#### Authenticate Requests

Use `passport.authenticate()`, specifying the `'linkedin-token'` strategy, to authenticate requests.

The post request to this route should include a JSON object with the keys `access_token` and optionally, `refresh_token` set to the credentials you receive from linkedin.

1) Set options and create OAuth2 instance:

```js
var code = req.body.code, //authorization_code you received earlier
    options = {
      client_id:      'YOUR_CLIENT_ID',
      client_secret:  'YOUR_CLIENT_SECRET',
      redirect_uri:   'YOUR_REDIRECT_URI',
      grant_type:     'authorization_code'
    },
    oauth2 = new OAuth2(
      options['client_id'],
      options['client_secret'],
      'https://www.linkedin.com',
      '',
      '/uas/oauth2/accessToken');
```

2) Request for OAuth access token and authenticate it (using OAuth2 library, preferred) .

*Note: if you would try debug after requesting access token and before authenticating it*
*you will have a very few time before it expiration (~15 sec). Consider this linkedIn policy*

```js
oauth2.getOAuthAccessToken(code, options, function(err, access_token, refresh_token, results) {
  if (err) { return next(new Error(err.data)) }

  //include access_token and expires into body to request for token
  req.body.access_token = access_token;
  req.body.expires      = results.expires;

  return passport.authenticate(provider, function(req, accessToken, refreshToken, profile, next) {
    //Yay! We've got the profile, so easy!!
    //do something with profile here and everything else
  })(req, res, req.next);
});
```

Or, you can try to make more classic request (without OAuth2 library).
In this case you have to receive token first

*Remember: you should include access_token (expires is optional) to request body before authenticating!*

```js
app.post('/auth/linkedin/token',
  passport.authenticate('linkedin-token'),
  function (req, res) {
    // do something with req.user
    res.send(req.user? 200 : 401);
  }
);
```

## Author

  [Vladimir Katansky](http://github.com/Blackening999)

## License

(The MIT License)

Copyright (c) 2014 Vladimir Katansky

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
