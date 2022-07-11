const gulp = require("gulp");
const concat = require("gulp-concat");
const terser = require("gulp-terser");
const postcss = require("gulp-postcss");
const cssnano = require("cssnano");
const autoprefixer = require("autoprefixer");
const { src, series, parallel, dest, watch } = require("gulp");
const browserSync = require("browser-sync").create();
const imagemin = require("gulp-imagemin");
const webpack = require("webpack-stream");
const sass = require("gulp-sass")(require("sass"));
const livereload = require("gulp-livereload");
const del = require("del");

const assetsPath = "src/assets/";
const readmePath = "README.md";
const jsPath = "src/js/**/*.*";
const cssPath = "src/css/**/*";
const wasmPath = "src/wasm/*.wasm";
const imagePath = "src/images/*";
const jsBoxedPath = "src/js/boxedwine/**/*.js";

const output = "extension/media/";

function iconTask() {
  return src(["src//*.ico", "src//*.icns"], "src//*.png").pipe(
    gulp.dest(output)
  );
}

function jsTask() {
  return src([jsPath, "!" + jsBoxedPath, "!node_modules"])
    .pipe(webpack(require("./webpack.prod.js")))
    .pipe(dest(output));
}

function jsTaskDev() {
  return src([jsPath, "!" + jsBoxedPath, "!node_modules"])
    .pipe(webpack(require("./webpack.dev.js")))
    .pipe(dest(output));
}

function cleanTask() {
  return del(output + "**/*");
}

function jsBoxedTask() {
  return src(["!" + jsPath, jsBoxedPath])
    .pipe(concat("boxedwine.js"))
    .pipe(terser())
    .pipe(dest(output));
}

function wasmTask() {
  return src(wasmPath).pipe(browserSync.stream()).pipe(dest(output));
}

function assetsTask() {
  return src([assetsPath + "assembler.zip", assetsPath + "boxedwine.zip"]).pipe(
    gulp.dest(output)
  );
}

function readmeTask() {
  return src(readmePath).pipe(gulp.dest("extension/"));
}

function imgTask() {
  //only using for favicon
  return src([imagePath + ".ico", "src/css/images/*"])
    .pipe(imagemin())
    .pipe(gulp.dest(output));
}

function cssTask() {
  return src([cssPath + ".scss", cssPath + ".css"])
    .pipe(sass({ includePaths: ["./node_modules"] }).on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(postcss([autoprefixer(), cssnano()])) //not all plugins work with postcss only the ones mentioned in their documentation
    .pipe(dest(output));
}

function watchTask() {
  livereload.listen();
  gulp.watch(
    [cssPath, jsPath, jsBoxedPath, assetsPath],
    { interval: 1000 },
    parallel(
      iconTask,
      jsTaskDev,
      jsBoxedTask,
      cssTask,
      readmeTask,
      wasmTask,
      assetsTask,
      imgTask
    )
  );
  gulp.watch(jsPath).on("change", browserSync.reload);
  gulp.watch(readmePath).on("change", browserSync.reload);
  gulp.watch(jsBoxedPath).on("change", browserSync.reload);
  gulp.watch(imagePath).on("change", browserSync.reload);
}

exports.watch = watchTask;
exports.build = series(
  parallel(
    iconTask,
    readmeTask,
    cleanTask,
    jsTask,
    jsBoxedTask,
    cssTask,
    wasmTask,
    assetsTask,
    imgTask
  )
);
