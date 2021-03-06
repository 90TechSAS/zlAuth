/**
 * WebApp Solica
 * http://docs.90tech.fr/solica
 *
 * Copyright 2014 Zenlabs
 * Non permissive commercial License.
 */

;(function(){
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

            this.setLogoutRoute = function(logoutRoute){
                this.logoutRoute = logoutRoute;
                return this;
            };

            this.setRefreshRoute = function(refreshRoute){
                this.refreshRoute = refreshRoute;
                return this;
            };

            this.setDirectLogin = function(){
                this.directLogin = true;
            }

            this.setCredentials = function(credentials){
                if (!credentials.password || !credentials.email){
                    throw 'Credentials must be like {email: email, password: pwd}'
                }
                this.credentials = credentials;
                return this;
            };

            this.setChangeTeamRoute = function(changeTeamRoute){
                this.changeTeamRoute = changeTeamRoute;
                return this;
            };

            this.$get = ['$window', '$timeout', '$http', '$location', '$localStorage', '$sessionStorage', 'jwtHelper', 'zlStorageEmitter', '$q',
                function($window, $timeout, $http, $location, $localStorage, $sessionStorage, jwtHelper, zlStorageEmitter, $q){
                    if (!self.appId || !self.rootUrl){
                        throw 'You should set appId and baseurl before using zlAuth';
                    }
                    return new AuthService($window, $timeout, $http, $location, $localStorage, $sessionStorage, jwtHelper, zlStorageEmitter, $q,
                        self.rootUrl, self.appId, self.loginRoute, self.refreshRoute, self.changeTeamRoute, self.directLogin, self.logoutRoute
                    );
                }];
        });


    AuthService.$inject = ['$window', '$timeout', '$http', '$location', '$localStorage', '$sessionStorage', 'jwtHelper', 'zlStorageEmitter', '$q'];


    /**
     *
     */
    function AuthService($window, $timeout, $http, $location, $localStorage, $sessionStorage, jwtHelper, zlStorageEmitter, $q, rootUrl, appId, loginRoute, refreshRoute, changeTeamRoute, directLogin, logoutRoute){

        var self = this;


        loginRoute      = loginRoute || '/login';
        refreshRoute    = refreshRoute || '/refresh/';
        changeTeamRoute = changeTeamRoute || '/login';

        //
        _.extend(self, {

            // Public methods
            redirectToAuth  : redirectToAuthServer,
            getToken        : getToken,
            disconnect      : disconnect,
            changeTeam      : changeTeam,
            registerObserver: registerObserver,
            setCredentials  : setCredentials,
            getCompany      : getCompany
        });

        self.observers = [];


        function setCredentials(credentials){
            if (!credentials.password || !credentials.email){
                throw 'Credentials must be like {email: email, password: pwd}'
            }
            this.credentials = credentials;
        }

        function registerObserver(obs){
            self.observers.push(obs);
        }

        function notify(){
            _.each(self.observers, function(o){
                o.notifyAuthChange && o.notifyAuthChange();
            });
        }


        init();
        zlStorageEmitter.on(('logout'), disconnectWithoutEmit);


        function init(){
            if ($location.hash() || $localStorage.accessToken){
                var tkn = $location.hash() || $localStorage.accessToken;
                if (checkValidity(tkn)){
                    setToken(tkn);
                } else{
                    refreshToken(tkn).then(setToken, disconnect);
                }
            } else{
                redirectToAuthServer();
            }
        }


        function disconnectWithoutEmit(opts){
            var forced = _.get(opts, 'force')

            clear();
            if (logoutRoute) {
                $window.location.href = rootUrl + logoutRoute + '?client=' + appId + ( forced ? '' : ('&redirectUri=' + $location.url()))
                return
            }
            redirectToAuthServer();
        }


        /**
         *
         */
        function disconnect(opts){
            zlStorageEmitter.emit('logout', 'logout');
            disconnectWithoutEmit(opts);
        }

        /**
         * Save token in Self and in LocalStorage
         * + Calls SetTokenData
         */
        function setToken(token){
            $location.hash('');
            $localStorage.accessToken = token;
            saveTokenData(token);
            notify();
        }


        function saveTokenData(token){
            var tokenData           = jwtHelper.decodeToken(token);
            $sessionStorage.user    = tokenData.user;
            $sessionStorage.company = tokenData.selectedCompany;
            $sessionStorage.roles   = tokenData.roles;
        }


        function refreshToken(token){
            return $http({
                url              : rootUrl + refreshRoute + (token),
                skipAuthorization: true,
                method           : 'GET'
            }).then(function(data){
                return data.data.token
            });
        }

        /**
         * @returns {promise}
         */
        function getToken(forceRefresh){

            var def   = $q.defer();
            var token = $localStorage.accessToken;
            if (!self.credentials && !token) {
                disconnect();
                def.reject();
            }

            if (!forceRefresh && checkValidity(token)){
                def.resolve(token);
            } else{
                if (token){
                    refreshToken(token).then(
                        function(token){
                            def.resolve(token);
                            setToken(token);
                        }, function(){
                            //  def.reject({status: 403, config: {ignoreErrors: [403]}});
                            if (directLogin){
                                $http({
                                    url              : rootUrl + loginRoute,
                                    skipAuthorization: true,
                                    method           : 'POST',
                                    data             : {
                                        email   : self.credentials.email,
                                        password: self.credentials.password,
                                        client  : appId
                                    }
                                }).then(function(data){
                                    setToken(data.data.token);
                                    def.resolve(data.data.token);

                                }, function(data){
                                    console.info(data);
                                    def.reject();
                                })
                            } else{
                                disconnect()
                            }
                        });
                } else{
                    if (directLogin){
                        $http({
                            url              : rootUrl + loginRoute,
                            skipAuthorization: true,
                            method           : 'POST',
                            data             : {
                                email   : self.credentials.email,
                                password: self.credentials.password,
                                client  : appId
                            }
                        }).then(function(data){
                            setToken(data.data.token);
                            def.resolve(data.data.token);
                        }, function(data){
                            console.info(data);
                            def.reject();
                        })
                    } else{
                        disconnect()
                    }                 //   def.reject({status: 403, config: {ignoreErrors: [403]}});
                }
            }
            return def.promise;
        }

        /**
         *
         */
        function clear(){
            self.accessToken = null;
            delete $localStorage.accessToken;
            delete $localStorage.global;
            delete $sessionStorage.user;
            delete $sessionStorage.company;
            delete $sessionStorage.roles;
        }

        function checkValidity(token){
            return token && !jwtHelper.isTokenExpired(token, 120);
        }

        function getCompany(){
            return $sessionStorage.company
        }


        function redirectToAuthServer(){
            $timeout(function(){
                $window.location.href = rootUrl + loginRoute + '?client=' + appId;
            });
        }

        function changeTeam(companyId){
            window.location.href = rootUrl + changeTeamRoute +  '?client=' + appId + '&company=' + btoa(companyId)
        }

        return self;

    }

})();
