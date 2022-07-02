const gulp = require("gulp");
const concat = require("gulp-concat");
const terser = require("gulp-terser");
const sourcemaps = require("gulp-sourcemaps");
const postcss = require("gulp-postcss");
const cssnano = require("cssnano");
const autoprefixer = require("autoprefixer");
const { src, series, parallel, dest, watch } = require("gulp");
const browserSync = require("browser-sync").create();
const imagemin = require("gulp-imagemin");
const webpack = require("webpack-stream");
const sass = require("gulp-sass")(require("sass"));
const livereload = require("gulp-livereload");
const htmlmin = require("gulp-htmlmin");
const del = require("del");

const assetsPath = "src/assets/";
const output = "public/";
const jsPath = "src/js/**/*.*";
const cssPath = "src/css/**/*";
const wasmPath = "src/wasm/*.wasm";
const htmlPath = "src/html/";
const imagePath = "src/images/*";
const jsBoxedPath = "src/js/boxedwine/**/*.js";

const electronOutput = "webview-sample/media/";
const electronJS = "src/electron/*.js";

//Electron
function jsTaskMainElectron() {
  return src([electronJS]).pipe(dest(electronOutput));
}

function iconTaskElectron() {
  return src(
    ["src/electron/*.ico", "src/electron/*.icns"],
    "src/electron/*.png"
  ).pipe(gulp.dest(electronOutput));
}

function jsTaskElectron() {
  return src([jsPath, "!" + jsBoxedPath, "!node_modules"])
    .pipe(webpack(require("./webpack.dev.js")))
    .pipe(dest(electronOutput));
}

function cleanTaskElectron() {
  return del(electronOutput + "**/*");
}

function jsBoxedTaskElectron() {
  return src(["!" + jsPath, jsBoxedPath])
    .pipe(concat("boxedwine.js"))
    .pipe(terser())
    .pipe(dest(electronOutput));
}

function wasmTaskElectron() {
  return src(wasmPath).pipe(browserSync.stream()).pipe(dest(electronOutput));
}

function copyHtmlElectron() {
  return src([htmlPath + "boxedwine.html", htmlPath + "index.html"])
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(gulp.dest(electronOutput));
}

function assetsTaskElectron() {
  return src([
    assetsPath + "assembler.zip",
    assetsPath + "electron/boxedwine.zip",
  ]).pipe(gulp.dest(electronOutput));
}

function imgTaskElectron() {
  //only using for favicon
  return src([imagePath + ".ico", "src/css/images/*"])
    .pipe(imagemin())
    .pipe(gulp.dest(electronOutput));
}

function cssTaskElectron() {
  return src([cssPath + ".scss", cssPath + ".css"])
    .pipe(sass({ includePaths: ["./node_modules"] }).on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(postcss([autoprefixer(), cssnano()])) //not all plugins work with postcss only the ones mentioned in their documentation
    .pipe(dest(electronOutput));
}

function fontTaskElectron() {
  return src("src/fonts/*")
    .pipe(browserSync.stream())
    .pipe(dest(electronOutput));
}

//WEB
//Production
function jsTaskProd() {
  return src([jsPath, "!" + jsBoxedPath, "!node_modules"])
    .pipe(webpack(require("./webpack.prod.js")))
    .pipe(browserSync.stream())
    .pipe(dest(output));
}

function cleanTask() {
  return del(["public/**/*"]);
}

//develop
function jsTask() {
  return src([jsPath, "!" + jsBoxedPath, "!node_modules"])
    .pipe(webpack(require("./webpack.dev.js")))
    .pipe(browserSync.stream())
    .pipe(dest(output));
}

//Common
function fontTask() {
  return src("src/fonts/*").pipe(browserSync.stream()).pipe(dest(output));
}

function jsBoxedTask() {
  return src(["!" + jsPath, jsBoxedPath])
    .pipe(sourcemaps.init())
    .pipe(concat("boxedwine.js"))
    .pipe(terser())
    .pipe(sourcemaps.write("."))
    .pipe(browserSync.stream())
    .pipe(dest(output));
}

function wasmTask() {
  return src(wasmPath).pipe(browserSync.stream()).pipe(dest(output));
}

function copyHtml() {
  return src([htmlPath + "boxedwine.html", htmlPath + "index.html"])
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(gulp.dest("public"));
}

function assetsTask() {
  return src([
    assetsPath + "assembler.zip",
    assetsPath + "electron/boxedwine.zip",
  ]).pipe(gulp.dest("public"));
}

function imgTask() {
  //only using for favicon
  return src([imagePath + ".ico", "src/css/images/*"])
    .pipe(imagemin())
    .pipe(gulp.dest("public"));
}

function cssTask() {
  return src([cssPath + ".scss", cssPath + ".css"])
    .pipe(sourcemaps.init())
    .pipe(sass({ includePaths: ["./node_modules"] }).on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(postcss([autoprefixer(), cssnano()])) //not all plugins work with postcss only the ones mentioned in their documentation
    .pipe(sourcemaps.write("."))
    .pipe(browserSync.stream())
    .pipe(dest(output));
}

function watchTask() {
  browserSync.init({
    server: {
      baseDir: "./public/",
    },
  });
  livereload.listen();
  gulp.watch(
    [cssPath, jsPath, jsBoxedPath, assetsPath, htmlPath],
    { interval: 1000 },
    parallel(
      cssTask,
      jsTask,
      wasmTask,
      assetsTask,
      copyHtml,
      jsBoxedTask,
      imgTask
    )
  );
  gulp.watch(htmlPath).on("change", browserSync.reload);
  gulp.watch(jsPath).on("change", browserSync.reload);
  gulp.watch(jsBoxedPath).on("change", browserSync.reload);
  gulp.watch(imagePath).on("change", browserSync.reload);
}

//BUILD Electron
exports.electron = series(
  parallel(
    iconTaskElectron,
    cleanTaskElectron,
    jsTaskMainElectron,
    jsTaskElectron,
    jsBoxedTaskElectron,
    cssTaskElectron,
    wasmTaskElectron,
    assetsTaskElectron,
    copyHtmlElectron,
    imgTaskElectron,
    fontTaskElectron
  )
);

//Develop Web
exports.watch = series(
  parallel(
    jsTask,
    jsBoxedTask,
    cssTask,
    wasmTask,
    assetsTask,
    copyHtml,
    imgTask,
    fontTask
  ),
  watchTask
);
