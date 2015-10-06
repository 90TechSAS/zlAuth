[![Build Status](https://travis-ci.org/90TechSAS/zlAuth.svg?branch=master)](https://travis-ci.org/90TechSAS/zlAuth)

# zlAuth
  
  ## Usage
  - It is mandatory to set the root url and appId:
  
    ```javascript
        myApp.config(['zlAuthProvider', function(zlAuthProvider){
            zlAuthProvider.setAppId(appId)
                .setRootUrl(authUrl)
        }]);
    ```
    
  You can also set loginRoute (defaults to _/user/login_) and token refreshRoute (_/user/refresh_)
  
  - If a token is found in location.hash (the user has been redirected from login page) or in local storage, the module will use it.
  - Set zlAuth.getToken() as your token provider whenever you need id. This returns a promise that will be resolved immediately if the token is still valid, or after refreshing it. If there is no way to obtain a valid token, the module will redirect the user to loginRoute.
