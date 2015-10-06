var gulp     = require('gulp');
var inject   = require('gulp-inject');
var annotate = require('gulp-ng-annotate');
var Server = require('karma').Server;


gulp.task('scripts', function(){
    return gulp.src('./src/**/*.js')
        .pipe(annotate())
        .pipe(gulp.dest('./build'));
});

gulp.task('test', ['scripts'], function(done){
    return new Server({
        configFile: __dirname + '/karma.conf.js',
        singleRun: true
    }, done).start();
});


gulp.task('watch', function(){

    gulp.watch(['./src/**/*.js'], ['test']);
    gulp.watch(['./tst/**/*.js'], ['test']);
});


gulp.task('default', ['test','watch']);