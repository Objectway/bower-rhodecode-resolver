# bower-rhodecode-resolver
A Bower resolver to allow integration with a RhodeCode repository

## Installation

`npm install -g bower-rhodecode-resolver`

In order to use Bower with Rhodecode you need 2 components (npm packages):

1. [bower-rhodecode-resolver](https://www.npmjs.com/package/bower-rhodecode-resolver) - A Bower resolver to allow integration with a RhodeCode repository
2. [bower](https://www.npmjs.com/package/bower) - Bower version 1.5.0 and above.

## Client Configuration
Edit your ~/.bowerrc and add:

```json
...
  "resolvers": [
    "bower-rhodecode-resolver"
  ],
  "rhodecode": {
  	"token": "1234567890asdfghjklzxcvbnm",
  	"repo": "www.your-rhodecode-repo.com"
  }
...
```

### Where can I find the auth token?
As explained in the [rhodecode documentation](https://docs.rhodecode.com/RhodeCode-Enterprise/auth/token-auth.html#creating-tokens), each user can find his own token on the rhodecode repository web site under: Username -> My Account -> Auth tokens

## Rhodecode Configuration (v3)

### Enabling VCS Tokens
#### On the website
As explained [on the rhodecode docs](https://docs.rhodecode.com/RhodeCode-Enterprise/auth/token-auth.html), you have to enable `rhodecode.lib.auth_modules.auth_token` plugin.

#### On the server instance
If it doesn't work, maybe you have to change some parameters on your rhodecode instance. 

As explained [on the Rhodecode support site](https://rhodecode.tenderapp.com/help/discussions/problems/9368-authentication-via-token-not-working), you have to change in rhodecode.ini the value of 
`api_access_controllers_whitelist = ChangesetController:changeset_patch, ChangesetController:changeset_raw, FilesController:raw, FilesController:archivefile`.