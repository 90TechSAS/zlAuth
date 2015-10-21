describe('AuthService', function(){

    var zlAuth, $window, $localStorage;

    var authUrl      = 'https://MYAUTH.fr';
    var appId        = 'THISISMYAPPID';
    var loginRoute   = '/login';
    var refreshRoute = '/refresh/';


    beforeEach(function(){
        angular.module('90TechSAS.zlAuth.test', ['90TechSAS.zlAuth']);

        module('90TechSAS.zlAuth.test', function($provide, _zlAuthProvider_){
            _zlAuthProvider_.setAppId(appId)
                .setRootUrl(authUrl);

            $window       = {
                // now, $window.location.path will update that empty object
                location: {},
                // we keep the reference to window.document
                document: window.document
            };
            $localStorage = {};
            $provide.constant('$window', $window);
            $provide.constant('$localStorage', $localStorage);

        });
    });


    describe('after login with Invalid token', function(){

        var $location, $localStorage, $rootScope, $httpBackend, $timeout;
        var invalidToken = jwtMake(false);

        beforeEach(function(){
            inject(function(_$location_, _$localStorage_, _$rootScope_, _$httpBackend_, _$timeout_){

                $location     = _$location_;
                $localStorage = _$localStorage_;
                $rootScope    = _$rootScope_;
                $httpBackend  = _$httpBackend_;
                $timeout      = _$timeout_;
                _$location_.hash(invalidToken);

            });
            inject(function(_zlAuth_){
                zlAuth = _zlAuth_;
            });
        });


        afterEach(function(){
            $httpBackend.verifyNoOutstandingExpectation()
        });

        it('should try to refresh', function(){
            $httpBackend
                .expectGET(authUrl + refreshRoute + invalidToken).respond(undefined);
            $rootScope.$digest();
        });


        it('should disconnect if refresh fails', function(){
            $httpBackend
                .expectGET(authUrl + refreshRoute + invalidToken).respond(400, '');
            $httpBackend.flush();
            $timeout.flush();
            expect($window.location.href).toEqual(authUrl + loginRoute + '?client=' + appId);
        });

    });
});