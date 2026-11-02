const gulp = require("gulp");
const concat = require("gulp-concat");
const postcss = require("gulp-postcss");
const cssnano = require("cssnano");
const autoprefixer = require("autoprefixer");
const { src, series, parallel, dest, watch } = require("gulp");
const webpack = require("webpack-stream");
const sass = require("gulp-sass")(require("sass"));
const { deleteAsync } = require("del");
const { Transform } = require("stream");
const fs = require("fs");
const path = require("path");
const {
  computeBwBuildId,
  ZIP_DIR,
  ZIPS,
} = require("./scripts/bw-build-id.cjs");

// gulp 5 decodes src() streams as UTF-8 unless told not to
const BINARY = { encoding: false };

const readmePath = "README.md";
const jsPath = "src/js/**/*.*";
const cssPath = "src/css/**/*";
const wasmPath = "src/wasm/boxedwine.wasm";
const jsBoxedPath = "src/js/boxedwine/**/*.js";
const fontPath = "src/fonts/*";
const htmlPath = "src/html/webview.html";
const syntaxPath = "src/syntax/**/*.js";
const extensionSrc = "extension/src";
const extensionOut = "extension/out";

// shipped as they are: src/html/webview.html loads them in order
const stackPaths = [
  "src/js/boxedwine/boxedwine.js",
  "src/js/boxedwine/jszip.min.js",
  "src/js/boxedwine/boxedwine-shell.js",
  "src/js/boxedwine/bw-snapshot.js",
  "src/js/boxedwine/page/*.js",
];
const zipPaths = ZIPS.map((zip) => ZIP_DIR + "/" + zip);

const output = "extension/media/";
// the shell's Config.locate*BaseUrl (BW_ZIP_BASE in the webview)
const zipOutput = output + "latest26/";

function iconTask() {
  return src(["src//*.ico", "src//*.icns"], BINARY).pipe(gulp.dest(output));
}

// under gulp 5, a src() stream piped into webpack-stream fails on every watch run after the first
function jsTask() {
  return webpack(require("./webpack.prod.js"))
    .on("data", function (file) {
      console.log(file.path); // Log each processed file
    })
    .pipe(dest(output));
}

function jsTaskDev() {
  return webpack(require("./webpack.dev.js"))
    .on("data", function (file) {
      console.log(file.path); // Log each processed file
    })
    .pipe(dest(output));
}

function cleanTask() {
  return deleteAsync(output + "**/*");
}

// deletes outputs whose source is gone, and the parser bundle; tsc's current ones stay for `tsc -w`
function cleanExtensionOutTask(cb) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      const compiled = /^(.*)\.js(\.map)?$/.exec(
        path.relative(extensionOut, file),
      );
      const hasSource =
        compiled &&
        [".ts", ".js"].some((ext) =>
          fs.existsSync(path.join(extensionSrc, compiled[1] + ext)),
        );
      if (!hasSource) fs.rmSync(file);
    }
  };
  if (fs.existsSync(extensionOut)) walk(extensionOut);
  cb();
}

function syntaxTask() {
  return webpack(require("./webpack.syntax.js")).pipe(
    dest(extensionOut + "/syntax/"),
  );
}

function stackTask() {
  return src(stackPaths, BINARY).pipe(dest(output));
}

function wasmTask() {
  return src(wasmPath, BINARY).pipe(dest(output));
}

function zipsTask() {
  return src(zipPaths, BINARY).pipe(dest(zipOutput));
}

function injectBwBuildId() {
  const bwBuildId = computeBwBuildId();
  console.log("BW_BUILD_ID " + bwBuildId);
  return new Transform({
    objectMode: true,
    transform(vinyl, enc, cb) {
      const text = vinyl.contents.toString();
      const found = text.split("__BW_BUILD_ID__").length - 1;
      if (found !== 1)
        return cb(
          new Error(
            vinyl.relative +
              " must contain __BW_BUILD_ID__ exactly once, found " +
              found,
          ),
        );
      vinyl.contents = Buffer.from(text.replace("__BW_BUILD_ID__", bwBuildId));
      cb(null, vinyl);
    },
  });
}

function htmlTask() {
  return src(htmlPath).pipe(injectBwBuildId()).pipe(dest(output));
}

function readmeTask() {
  return src(readmePath).pipe(gulp.dest("extension/"));
}

function cssTask() {
  return src([cssPath + ".scss", cssPath + ".css"])
    .pipe(sass({ loadPaths: ["./node_modules"] }).on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(postcss([autoprefixer(), cssnano()])) //not all plugins work with postcss only the ones mentioned in their documentation
    .pipe(dest(output));
}

function fontTask() {
  return src(fontPath, BINARY).pipe(dest(output));
}

function watchTask() {
  gulp.watch(syntaxPath, { interval: 1000 }, syntaxTask);
  gulp.watch(
    [cssPath, jsPath, jsBoxedPath, htmlPath, wasmPath, ...zipPaths, readmePath],
    { interval: 1000 },
    parallel(
      iconTask,
      jsTaskDev,
      stackTask,
      htmlTask,
      fontTask,
      cssTask,
      readmeTask,
      wasmTask,
      zipsTask,
    ),
  );
}

exports.watch = watchTask;
// clean first: running it alongside the copies could delete what they had just written
exports.build = series(
  parallel(cleanTask, cleanExtensionOutTask),
  parallel(
    iconTask,
    readmeTask,
    jsTask,
    fontTask,
    stackTask,
    htmlTask,
    cssTask,
    wasmTask,
    zipsTask,
    syntaxTask,
  ),
);
