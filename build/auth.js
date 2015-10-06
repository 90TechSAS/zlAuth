/**
 * WebApp Solica
 * http://docs.90tech.fr/solica
 *
 * Copyright 2014 Zenlabs
 * Non permissive commercial License.
 */

(function(){
    'use strict';

    angular
        .module('90TechSAS.zlAuth', [
            '90TechSAS.angular-storage-emitter',
            'angular-jwt',
            'ngStorage'
        ])
        .provider('zlAuth', function(){
            var self = this;

            this.setAppId = function(appId){
                this.appId = appId;
                return this;
            };

            this.setRootUrl = function(rootUrl){
                this.rootUrl = rootUrl;
                return this;
            };

            this.setLoginRoute = function(loginRoute){
                this.loginRoute = loginRoute;
                return this;
            };

            this.setRefreshRoute = function(refreshRoute){
                this.refreshRoute = refreshRoute;
                return this;
            };

            this.$get = ['$window', '$interval', '$timeout', '$http', '$location', '$localStorage', '$sessionStorage', 'jwtHelper', 'zlStorageEmitter', '$q',
                function($window, $interval, $timeout, $http, $location, $localStorage, $sessionStorage, jwtHelper, zlStorageEmitter, $q){
                    if (!self.appId || !self.rootUrl){
                        throw 'You should set appId and baseurl before using zlAuth';
                    }
                    return new AuthService($window, $interval, $timeout, $http, $location, $localStorage, $sessionStorage, jwtHelper, zlStorageEmitter, $q,
                        self.rootUrl, self.appId, self.loginRoute, self.refreshRoute
                    );
                }];
            //  return this;
        });


    AuthService.$inject = ['$window', '$interval', '$timeout', '$http', '$location', '$localStorage', '$sessionStorage', 'jwtHelper', 'zlStorageEmitter', '$q'];


    /**
     *
     */
    function AuthService($window, $interval, $timeout, $http, $location, $localStorage, $sessionStorage, jwtHelper, zlStorageEmitter, $q, rootUrl, appId, loginRoute, refreshRoute){

        var self = this;

        /**
         * @type promise
         */
        var accessToken = $q.defer();

        /**
         * @type timestamp
         */
        var expirationTimestamp = null;


        var loginRoute = loginRoute || '/user/login';
        var refresh    = refreshRoute || '/user/refresh';


        //
        _.extend(self, {

            // Public attributes
            accessToken        : accessToken,
            expirationTimestamp: expirationTimestamp,

            // Public methods
            redirectToAuth  : redirectToAuthServer,
            setTokenData    : setTokenData,
            setToken        : setToken,
            clearToken      : clearToken,
            getToken        : getToken,
            disconnect      : disconnect,
            changeTeam      : changeTeam,
            registerObserver: registerObserver,
        });

        self.observers = [];

        function registerObserver(obs){
            self.observers.push(obs);
        }

        function notify(){
            _.each(self.observers, function(o){
                o.notifyAuthChange();
            });
        }

        init(false);
        zlStorageEmitter.on(('logout'), disconnectWithoutEmit);


        function init(force){

            return authorize(force).then(
                function(token){
                    //Success
                    setToken(token);
                    var expMoment   = moment.unix(self.expirationTimestamp);
                    var limitMoment = moment(expMoment).subtract(9, 'minutes');
                    // Creation of an interval between in which we'll refresh token
                    var stop = $interval(function(){
                        if (moment().isBetween(limitMoment, expMoment)){
                            $interval.cancel(stop);
                            return init(true);
                        }
                    }, 300000);
                    notify();
                    return token;
                },
                //Failure
                function(f){
                    disconnect();
                }
            );
        }


        function disconnectWithoutEmit(){
            clearToken();
            clearUser();
            clearLocalstorage();
            redirectToAuthServer();
        }


        /**
         *
         */
        function disconnect(){
            zlStorageEmitter.emit('logout', 'logout');
            disconnectWithoutEmit();
        }

        /**
         * Save token in Self and in LocalStorage
         * + Calls SetTokenData
         */
        function setToken(token){
            $location.hash('');
            $localStorage.accessToken = token;
            self.accessToken.resolve(token);
            setTokenData(token);
        }


        function saveTokenData(token){
            var tokenData            = jwtHelper.decodeToken(token);
            self.expirationTimestamp = tokenData.exp;
            $sessionStorage.user     = tokenData.user;
            $sessionStorage.company  = tokenData.selectedCompany;
        }

        /**
         *  Extract user and company info
         *  so as to save it in sessionStorage
         */
        function setTokenData(token){
            var deferred = $q.defer();
            if (token){
                saveTokenData(token);
                deferred.resolve(true);
            } else if (self.token){
                self.token.then(function(token){
                    saveTokenData(token);
                    deferred.resolve(true);
                });
            } else{
                deferred.reject('setTokenData Failed');
            }
            return deferred;
        }


        function refreshToken(token){
            return $http({
                url              : rootUrl + refreshRoute + (token),
                skipAuthorization: true,
                method           : 'GET'
            });
        }

        /**
         * @returns {promise}
         */
        function getToken(){
            var def = $q.defer();
            if (self.accessToken){
                self.accessToken.promise.then(function(tkn){
                    if (checkValidity(tkn)){
                        def.resolve(tkn);
                    } else{
                        init().then(function(tok){
                            def.resolve(tok);
                        }, function(){
                            def.reject()
                        });
                    }
                });
                // return self.accessToken.promise;
            } else{
                def.reject();
            }
            return def.promise;
        }

        /**
         *
         */
        function clearToken(){
            self.accessToken = null;
            delete $localStorage.accessToken;
        }

        /**
         *
         */
        function clearUser(){
            delete $sessionStorage.user;
            delete $sessionStorage.company;
        }

        function checkValidity(token){
            return !jwtHelper.isTokenExpired(token, 120);
        }


        function authorize(force){
            var tok          = $location.hash() || $localStorage.accessToken;
            self.accessToken = $q.defer();
            if (tok){
                //Token is either in localStorage or in URL anchor
                if (checkValidity(tok, 120) && !force){
                    //Token is still valid
                    self.accessToken.resolve(tok);
                } else{
                    // Need to revalidate
                    refreshToken(tok).then(
                        function(response){
                            self.accessToken.resolve(response.data.token);
                        }, function(data){
                            self.accessToken.reject('unable to refresh token: ' + data);
                        }
                    );
                }
            } else{
                self.accessToken.reject('Unable to authenticate');
            }
            return self.accessToken.promise;
        }

        function clearLocalstorage(){
            delete $localStorage.global;
            delete $localStorage.user;
            delete $localStorage.company;
        }


        function redirectToAuthServer(){
            self.clearToken();

            $timeout(function(){
                $window.location.href = rootUrl + loginRoute + '?client=' + appId;
            });
        }

        function changeTeam(){
            window.location.href = rootUrl + 'team/change?client=' + appId + '&token=' + $localStorage.accessToken;
        }

        return self;

    }

})();
