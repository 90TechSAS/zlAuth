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
                        self.rootUrl, self.appId, self.loginRoute, self.refreshRoute, this.changeTeamRoute
                    );
                }];
        });


    AuthService.$inject = ['$window', '$timeout', '$http', '$location', '$localStorage', '$sessionStorage', 'jwtHelper', 'zlStorageEmitter', '$q'];


    /**
     *
     */
    function AuthService($window, $timeout, $http, $location, $localStorage, $sessionStorage, jwtHelper, zlStorageEmitter, $q, rootUrl, appId, loginRoute, refreshRoute, changeTeamRoute){

        var self = this;


        loginRoute      = loginRoute || '/login';
        refreshRoute    = refreshRoute || '/refresh/';
        changeTeamRoute = changeTeamRoute || '/companies/change';


        //
        _.extend(self, {

            // Public methods
            redirectToAuth  : redirectToAuthServer,
            getToken        : getToken,
            disconnect      : disconnect,
            changeTeam      : changeTeam,
            registerObserver: registerObserver
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
                disconnect();
            }
        }


        function disconnectWithoutEmit(){
            clear();
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
            saveTokenData(token);
            notify();
        }


        function saveTokenData(token){
            var tokenData           = jwtHelper.decodeToken(token);
            $sessionStorage.user    = tokenData.user;
            $sessionStorage.company = tokenData.selectedCompany;
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
        function getToken(){
            var def   = $q.defer();
            var token = $localStorage.accessToken;
            if (checkValidity(token)){
                def.resolve(token);
            } else{
                if (token){
                    refreshToken(token).then(
                        function(token){
                            def.resolve(token);
                            setToken(token);
                        }, function(){
                          //  def.reject({status: 403, config: {ignoreErrors: [403]}});
                            disconnect()
                        });
                } else{
                    disconnect();
                 //   def.reject({status: 403, config: {ignoreErrors: [403]}});
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
        }

        function checkValidity(token){
            return token && !jwtHelper.isTokenExpired(token, 120);
        }


        function redirectToAuthServer(){
            $timeout(function(){
                $window.location.href = rootUrl + loginRoute + '?client=' + appId;
            });
        }

        function changeTeam(){
            window.location.href = rootUrl + changeTeamRoute + '?client=' + appId;// + '&token=' + $localStorage.accessToken;
        }

        return self;

    }

})();
