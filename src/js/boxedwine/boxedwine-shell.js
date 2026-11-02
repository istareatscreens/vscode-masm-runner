        // the webview URL is VS Code's host page, never configuration
        let ALLOW_PARAM_OVERRIDE_FROM_URL = false;
        let ROOT = "/root";
        let STORAGE_INDEXED_DB = "INDEXED_DB";
        let STORAGE_MEMORY = "MEMORY";

        let DEFAULT_LOAD_DESKTOP = false;
        let DEFAULT_SOUND_ENABLED = true;
        let DEFAULT_DISABLE_HIDE_CURSOR = false;
        let DEFAULT_APP_DIRECTORY = "/home/username/.wine/dosdevices/c:/files";
        let DEFAULT_BPP = 32;
        let DEFAULT_FRAME_SKIP = "0";
        let DEFAULT_AUDIO_FREQ = 11025;
        let DEFAULT_ROOT_ZIP_FILE = "boxedwine.zip";
        //params
        let Config = {};
        Config.locateRootBaseUrl = ""; // ie "assets/"
        Config.locateAppBaseUrl = "";
        Config.locateOverlayBaseUrl = "";
        Config.urlParams = "";
        Config.storageMode = STORAGE_INDEXED_DB;
        Config.persist_d_drive = true;
        Config.WorkingDir = "";
        Config.loadDesktop = false;
        Config.appSubfolder = "";
				
        var isRunning = false;

        function setConfiguration() {
            Config.appDirPrefix = DEFAULT_APP_DIRECTORY;
            Config.loadDesktop = getLoadDesktop();
            Config.rootZipFile = getRootZipFile("root"); //MANUAL:"base.zip";
            Config.extraZipFiles = getZipFileList("overlay"); //MANUAL:"dlls.zip;fonts.zip";
            Config.appZipFile = getAppZipFile("app"); //MANUAL:"chomp.zip";
            Config.appPayload = getPayload("app-payload"); 
            Config.extraPayload = getPayload("overlay-payload"); 
            Config.Program = getExecutable(); //MANUAL:"CHOMP.EXE";
            Config.ProgramArgs = getProgramArgs();
            Config.storageMode = getStorageMode();
            Config.isSoundEnabled = getSound();
            Config.audioFreq = getAudioFreq();
            Config.disableHideCursor = getDisableHideCursor();
            Config.bpp = getBitsPerPixel();
			Config.cpu = getCPU();
			Config.envProp = getEnvProp();
			Config.emEnvProps = getEmscriptenEnvProps();
			Config.frameSkip = getFrameSkip();
			Config.resolution = getResolution();
			Config.ddrawOverridePath = getDDrawOverridePath();
			Config.payloadZipFile = "app.zip";
			Config.d_drive = "/d_drive";
			Config.d_drive_guest = "/home/username/.wine/drive_d";
        }
        function allowParameterOverride() {
            if(Config.urlParams.length >0) {
                return true;
            }
            return ALLOW_PARAM_OVERRIDE_FROM_URL;
        }
        function getEmscriptenEnvProps() {
            var props = getParameter("em-env").trim();
            let allProps = [];
	        //allProps.push({key: 'LIBGL_NPOT', value: 2});
	        //allProps.push({key: 'LIBGL_DEFAULT_WRAP', value: 0});
	        //allProps.push({key: 'LIBGL_MIPMAP', value: 3});	        
            if(allowParameterOverride()){
                if(props.length > 6) {
                	if( (props.startsWith("%22") && props.endsWith("%22") )
                		|| (props.startsWith('%27') && props.endsWith('%27'))){
                    	props = props.substring(3, props.length - 3);
	                	props = props.split('%20').join(' ');
            			props.trim().split(";").forEach(function(item){
            				let kv = item.split(":");
            				if (kv.length == 2) {
    	    					let key = kv[0].trim();
    	        				let value = kv[1].trim();
    	        				let existingIndex = allProps.findIndex(v => v.key === key);
    	        				if (existingIndex > -1) {
    	        				    allProps.splice(existingIndex, 1);
								}
	            				allProps.push({key: key, value: value});
            				}
            			});
                	}else{
	                	console.log("EMSCRIPTEN ENV props parameter must be in quoted string");
                	}
                }
            }
            if(allProps.length > 0) {
                console.log("setting EMSCRIPTEN ENV props:");
            	allProps.forEach(function(prop){
            		console.log(prop.key + " = " + prop.value);
            	});
            }
            return allProps;
        }
        function getDDrawOverridePath() {
            var property = getParameter("ddrawOverride").trim();
            if(allowParameterOverride() && property.length > 0){
                if( (property.startsWith("%22") && property.endsWith("%22") )
                	|| (property.startsWith('%27') && property.endsWith('%27'))){
                    return property.substring(3, property.length - 3);
                }else{
	                console.log("ddrawOverride path must be in quoted string");
                }
            }
            return null;
        }
        function getEnvProp() {
            var property = getParameter("env").trim();
            if(allowParameterOverride()){
                if(property.length > 6) {
                	if( (property.startsWith("%22") && property.endsWith("%22") )
                		|| (property.startsWith('%27') && property.endsWith('%27'))){
                    	let kv = property.substring(3, property.length - 3).split(':');
                    	return '"' + kv[0].trim() + "=" + kv[1].trim() + '"';
                	}else{
	                	console.log("ENV property must be in quoted string");
                	}
                }
            }
            return '';
        }
        function getCPU() {
            var cpu = getParameter("cpu");
            if(!allowParameterOverride()){
                cpu = "";
            }else if(cpu == "p2") {
            }else if(cpu == "p3") {
            }else{
                cpu = "";
            }
            if(cpu.length > 0) {
            	console.log("setting CPU to: "+cpu);
            }
            return cpu;
        }
        function getResolution() {
            var resolution = getParameter("resolution");
            if(!allowParameterOverride()){
                resolution = null;
            }else{
            	if (resolution != null) {
            		if (resolution.indexOf('x') > -1) {
            			let resNumbers = resolution.split('x');
            			if (!(resNumbers.length == 2 && isNumber(resNumbers[0]) && isNumber(resNumbers[1]))) {
            				resolution = null;
            			}            				
            		} else {
            			resolution = null;
            		}
            	}
            }
            if (resolution == null) {
            	console.log("not setting Resolution");
            } else {
            	console.log("setting Resolution to: "+resolution);
            }
            return resolution;
        }
        function isNumber(num) {
        	const result = Number(num);
        	return !isNaN(result) && result > 0 && result < 2000;
        }
        function getFrameSkip() {
            var frameskip =  getParameter("skipFrameFPS");
            if(!allowParameterOverride()){
                frameskip = DEFAULT_FRAME_SKIP;
            }else if(frameskip == ""){
                frameskip = DEFAULT_FRAME_SKIP;
            }else if(Number(frameskip) < 0 || Number(frameskip) > 50){
                frameskip = DEFAULT_FRAME_SKIP;
            }
            console.log("setting skipFrameFPS to: "+frameskip);
            return frameskip;
        }
        function getBitsPerPixel() {
            var bpp =  getParameter("bpp");
            if(!allowParameterOverride()){
                bpp = DEFAULT_BPP;
            }else if(bpp == "8") {
                bpp = 8;
            }else if(bpp == "16") {
                bpp = 16;
            }else if(bpp == "32"){
                bpp = 32;
            }else{
                bpp = DEFAULT_BPP;
            }
            console.log("setting BPP to: "+bpp);
            return bpp;
        }
        function getLoadDesktop() {
            var loadDesktop =  getParameter("desktop");
            if(!allowParameterOverride()){
                loadDesktop = DEFAULT_LOAD_DESKTOP;
            }else if(loadDesktop == "true") {
                loadDesktop = true;
            }else if(loadDesktop == "false"){
                loadDesktop = false;
            }else{
                loadDesktop = DEFAULT_LOAD_DESKTOP;
            }
            console.log("setting load Desktop to: "+loadDesktop);
            return loadDesktop;
        }
        function getPayload(param) {
            var payload =  getParameter(param);
            if(!allowParameterOverride()){
                payload = "";
            }
            return payload;
        }
        function getStorageMode() {
            var storageMode = getParameter("storage");
            if (!allowParameterOverride()) {
                storageMode = "";
            }
            if (storageMode === "memory") {
                storageMode = STORAGE_MEMORY;
            } else if (storageMode === "indexeddb" || storageMode === "indexed_db") {
                storageMode = STORAGE_INDEXED_DB;
            } else {
                storageMode = STORAGE_INDEXED_DB;
            }
            console.log("setting storage mode to: " + storageMode);
            return storageMode;
        }
        function getSound() {
            var soundEnabled =  getParameter("sound");
            if(!allowParameterOverride()){
                soundEnabled = DEFAULT_SOUND_ENABLED;
            }else if(soundEnabled == "true") {
                soundEnabled = true;
            }else if(soundEnabled == "false"){
                soundEnabled = false;
            }else{
                soundEnabled = DEFAULT_SOUND_ENABLED;
            }
            console.log("setting sound to: "+soundEnabled);
            return soundEnabled;
        }

        function getAudioFreq() {
            var audioFreq = getParameter("audioFreq");
            if (!allowParameterOverride()) {
                audioFreq = DEFAULT_AUDIO_FREQ;
            } else if (audioFreq == "22050") {
                audioFreq = 22050;
            } else if (audioFreq == "11025" || audioFreq == "") {
                audioFreq = DEFAULT_AUDIO_FREQ;
            } else {
                audioFreq = DEFAULT_AUDIO_FREQ;
            }
            console.log("setting audioFreq to: " + audioFreq);
            return audioFreq;
        }

        function getDisableHideCursor() {
            var disableHideCursor = getParameter("disableHideCursor");
            if (!allowParameterOverride()) {
                disableHideCursor = DEFAULT_DISABLE_HIDE_CURSOR;
            } else if (disableHideCursor == "true") {
                disableHideCursor = true;
                console.log("setting disableHideCursor to: " + disableHideCursor);
            } else if (disableHideCursor == "false") {
                disableHideCursor = false;
            } else {
                disableHideCursor = DEFAULT_DISABLE_HIDE_CURSOR;
            }            
            return disableHideCursor;
        }

        function getExecutable() {
            var prog =  getParameter("p");
            if(!allowParameterOverride() || prog===""){
                console.log("not setting program to execute");
            }else{
                if(prog.startsWith("%22") && prog.endsWith("%22")){
                    prog = prog.substring(3, prog.length - 3);
                }else if(prog.startsWith('%27') && prog.endsWith('%27')){
                    prog = prog.substring(3, prog.length - 3);
                }
                prog = decodeUrlValue(prog);
                console.log("setting program to execute to: "+prog);
            }
            return prog;
        }
        function getProgramArgs() {
            var args = getParameter("args");
            if (!allowParameterOverride() || args === "") {
                return [];
            }
            args = decodeUrlValue(args);
            let result = splitCommandLine(args);
            if (result.length > 0) {
                console.log("setting program arguments to: " + result.join(" "));
            }
            return result;
        }
        function getAppZipFile(param) {

            var filename =  getParameter(param);
            if(!allowParameterOverride() || filename===""){
                filename = "";
                console.log("not setting " + param + " zip file");
            }else{
                if(!filename.endsWith(".zip")){
                    filename = filename + ".zip";
                }
                console.log("setting " + param + " zip file to: "+filename);
            }
            return filename;
        }
        function getRootZipFile(param) {

            var filename =  getParameter(param);
            if(!allowParameterOverride() || filename===""){
                filename = DEFAULT_ROOT_ZIP_FILE;
            }else{
                if(!filename.endsWith(".zip")){
                    filename = filename + ".zip";
                }
            }
            console.log("setting " + param + " zip file to: "+filename);
            return filename;
        }
        function getZipFileList(param) {
            var zipFiles = [];
            var filenames =  getParameter(param);
            if(!allowParameterOverride() || filename===""){
                console.log("not setting " + param + " zip file(s)");
            }else{
                if(filenames.length > 0) {
                    var zipFilenames = filenames.split(';');
                    for(var i=0; i < zipFilenames.length;i++) {
                        var filename = zipFilenames[i];
                        if(!filename.endsWith(".zip")){
                            filename = filename + ".zip";
                        }
                        zipFiles.push(filename);
                    }
                }
            }
            if(zipFiles.length > 0) {
            	console.log("setting " + param + " zip file(s) to: "+zipFiles);
            }
            return zipFiles;
        }
        function getBase64Data(base64Data) {
            let bytes = atob(base64Data);
        	let contentLength = bytes.length;
    		var contents = new Uint8Array(contentLength);
			for (var i = 0; i < contentLength; i++) {
        		contents[i] = bytes.charCodeAt(i);
    		}
    		return contents;
        }
        function loadFile(pathPrefix, filename, callback) {
            // masm-editor: through the boot-asset cache (bw-cache.js) when present; a failed
            // download is retried with backoff, then reported to the parent app.
            var RETRY_MS = [1000, 2000, 4000, 8000, 15000];
            var attempt = 0;
            var stage = function (t) { if (window.bwBootStage) window.bwBootStage(t); };
            var fail = function (why) {
                console.error("[bw] could not load " + filename + " after " + (attempt + 1) + " attempts: " + why); // boot milestone (error)
                stage("Loading " + filename + " failed (" + why + ") - use Reset terminal in the notification");
                try { window.bwHost.post("emulator-slow", { runtime: window.BW_USE_MT ? "mt" : "st", reason: "could not load " + filename + ": " + why }); } catch (e) {}
            };
            var tryLoad = function () {
                var bw = window.BWCache;
                var onError = function (why) {
                    if (attempt >= RETRY_MS.length) { fail(why); return; }
                    var wait = RETRY_MS[attempt++];
                    console.warn("[bw] " + filename + ": " + why + " - retrying in " + wait + "ms (" + attempt + "/" + RETRY_MS.length + ")");
                    stage("Loading " + filename + " failed (" + why + "), retrying " + attempt + "/" + RETRY_MS.length);
                    setTimeout(tryLoad, wait);
                };
                var init = { method: 'GET', cache: attempt ? 'reload' : 'default' };
                var p;
                try {
                    if (bw && bw.fetchBuffer) p = Promise.resolve(bw.fetchBuffer(pathPrefix + filename, init));
                    else p = Promise.resolve((bw && bw.fetch ? bw.fetch : fetch)(pathPrefix + filename, init)).then(function (response) {
                        if (!response || response.status !== 200) return { status: response ? response.status : 0, buffer: null };
                        return response.arrayBuffer().then(function (buffer) { return { status: 200, buffer: buffer }; });
                    });
                } catch (e) { onError(String(e)); return; }
                p.then(function (r) {
                    if (!r || r.status !== 200) { onError("HTTP " + (r && r.status ? r.status : "no response")); return; }
                    if (!r.buffer || !r.buffer.byteLength) { onError("empty response"); return; }
                    callback(new Uint8Array(r.buffer));
                }).catch(function (e) { onError(String(e && e.message || e)); });
            };
            tryLoad();
		}
        function buildAppFileSystem(callback) {
            if(Config.appPayload.length > 0){
            	let uint8Array = getBase64Data(Config.appPayload);
            	createFile("/", Config.payloadZipFile, uint8Array);
                callback();
            }else if(Config.appZipFile.length > 0){
            	loadFile(Config.locateAppBaseUrl, Config.appZipFile, (uint8Array) => {
            		if (Config.Program.length > 0) {            	
            			let zipEntries = getZipEntries(uint8Array);
            		    let folder = Config.appZipFile.toLowerCase().endsWith('.zip') ?
            		    	 Config.appZipFile.substring(0, Config.appZipFile.length - 4) : Config.appZipFile;
            			let executablePathAndFilename = folder + "/" + Config.Program;
            			let exeFileList = zipEntries.filter(e => !e.directory && e.filename === executablePathAndFilename);
            			if (exeFileList.length == 1) {
            				Config.appSubfolder = folder;
            			}
            		}
            		createFile("/", Config.appZipFile, uint8Array);
            		callback();
            	});
            }else{
                callback();
            }
        }
        function buildExtraFileSystems(callback) {
	        let extraFSs = [];
            if(Config.extraPayload.length > 0){
            	let uint8Array = getBase64Data(Config.extraPayload);
            	createFile("/", "overlay.zip", uint8Array);
            	callback();
            }else if(Config.extraZipFiles.length > 0){
                for(let i = 0; i < Config.extraZipFiles.length; i++) {
                    loadFile(Config.locateOverlayBaseUrl, Config.extraZipFiles[i], (uint8Array) => {
                    	createFile("/", Config.extraZipFiles[i], uint8Array);
                    	extraFSs.push(Config.extraZipFiles[i]);
                    	if(extraFSs.length == Config.extraZipFiles.length) {
            				callback();
                        }
            		});
                }
            }else{
                callback();
            }
        }
        function initBrowserFilesystem(callback) {
    		console.log("Use Storage mode: "+Config.storageMode);
			FS.mkdir(ROOT);
			FS.mkdir(Config.d_drive);
			// D: is a dosdevices link to Config.d_drive_guest, as the image's c: is to ../drive_c
			FS.mkdirTree(ROOT + "/home/username/.wine/dosdevices");
			FS.writeFile(ROOT + "/home/username/.wine/dosdevices/d(_colon_).link", Config.d_drive_guest);
			// masm-editor: /root and /d_drive are plain MEMFS (the user's files live in the
			// parent app; the snapshot carries /root). Older builds' IDBFS stores are
			// imported once and deleted.
			bwMigrateLegacyStores(callback);
		}
        // One-time migration: the files of the legacy "/d_drive" store go to the parent app
        // (window.BW_LEGACY_GUEST_FILES) before both legacy databases are deleted. Any
        // failure leaves them for the next load.
        function bwMigrateLegacyStores(done) {
            var KEY = window.BW_STORAGE_KEY || "bw-storage-v", VER = window.BW_STORAGE_VERSION || "2";
            var prev = null;
            try { prev = localStorage.getItem(KEY); } catch (e) {}
            if (prev === VER || typeof indexedDB === "undefined" || typeof IDBFS === "undefined") { done(); return; }
            var finished = false;
            var finish = function (ok, why) {
                if (finished) return;
                finished = true;
                if (ok) { try { localStorage.setItem(KEY, VER); } catch (e) {} }
                console.log("[bw] guest storage migration " + (ok ? "done" : "deferred") + (why ? " (" + why + ")" : "")); // boot milestone
                done();
            };
            var deleteDb = function (name) {
                return new Promise(function (resolve) {
                    try {
                        var req = indexedDB.deleteDatabase(name);
                        req.onsuccess = function () { resolve(true); };
                        req.onerror = function () { resolve(false); };
                        req.onblocked = function () { resolve(false); };
                    } catch (e) { resolve(false); }
                });
            };
            try {
                FS.mount(IDBFS, { autoPersist: false }, Config.d_drive); // same mount name = same legacy database
            } catch (e) { finish(false, "mount: " + e); return; }
            var t0 = performance.now();
            FS.syncfs(true, function (err) {
                var files = [];
                if (!err) {
                    var walk = function (dir, rel) {
                        var names; try { names = FS.readdir(dir); } catch (e) { return; }
                        for (var i = 0; i < names.length; i++) {
                            var n = names[i]; if (n === "." || n === "..") continue;
                            var p = dir + "/" + n, st; try { st = FS.stat(p); } catch (e) { continue; }
                            if (FS.isDir(st.mode)) { walk(p, rel + n + "/"); continue; }
                            if (!FS.isFile(st.mode) || st.size > 4 * 1024 * 1024) continue;
                            try { files.push({ filename: rel + n, bytes: FS.readFile(p), size: st.size }); } catch (e) {}
                        }
                    };
                    walk(Config.d_drive, "");
                }
                // close IDBFS's cached connection so the delete is not blocked, then unmount
                try { var db = IDBFS.dbs && IDBFS.dbs[Config.d_drive]; if (db) { db.close(); delete IDBFS.dbs[Config.d_drive]; } } catch (e) {}
                try { FS.unmount(Config.d_drive); } catch (e) { finish(false, "unmount: " + e); return; }
                window.BW_LEGACY_GUEST_FILES = files;
                console.log("[bw] legacy guest store: " + files.length + " file(s) offered to the drawer (" + Math.round(performance.now() - t0) + "ms)"); // boot milestone
                Promise.all([deleteDb(Config.d_drive), deleteDb(ROOT)]).then(function (r) {
                    finish(r[0] && r[1], "deleted /d_drive=" + r[0] + " /root=" + r[1]);
                });
            });
        }
        // masm-editor: the file systems are ready -> the emulator starts at once
        function buildBrowserFileSystem() {
            start();
        }
        function start() {
        	if(isRunning){
                return;
            }
            startEmulator();
        }
        function startEmulator() {
            isRunning = true;
            Config.disableHideCursor = true; // no pointer lock in this app: never hide the cursor

            var params = getEmulatorParams();
            for(var i=0; i < params.length; i++) {
                Module['arguments'].push(params[i]);
            }

            // Instant startup (ST and MT): restore the snapshot when boxedwine.html set
            // noInitialRun, else cold-boot through emscripten's auto-main and capture.
            // Never call callMain: it deadlocks MT under PROXY_TO_PTHREAD.
            var proceed = function () {
                var snap = window.BWSnapshot;
                var fireReady = function (how, info) { if (window.bwFireReady) window.bwFireReady(how, info); };
                var stage = function (t) { if (window.bwBootStage) window.bwBootStage(t); };
                if (snap) {
                    if (Module.noInitialRun) {
                        // restore in postRun (runtime initialised, HEAPU8 available)
                        (Module.postRun = Module.postRun || []).push(function () {
                            if (snap.willRestore()) {
                                stage("Restoring the terminal");
                                // doRestore and the watchdog both discard + reload into a
                                // cold boot on failure
                                Promise.resolve(snap.doRestore(Module)).then(function (ok) {
                                    if (!ok) return;
                                    snap.watchRestore(Module).then(function (verified) {
                                        if (verified) fireReady("restore", null);
                                    });
                                });
                            } else {
                                // stale marker (no valid snapshot): reload into a cold boot
                                snap.discard().then(function () {
                                    try { window.bwHost.reload("stale-snapshot-marker"); } catch (_) {}
                                });
                            }
                        });
                    } else {
                        // cold boot: emscripten auto-boots main
                        snap.markColdBoot();
                        stage("Booting Windows console (first visit)");
                        snap.watchBoot(Module).then(function () {
                            // capture the factory state (input gate closed, no user file on
                            // D: yet); only the atomic copy is awaited
                            if (!snap.canCapture()) { fireReady("cold-nocapture", null); return; }
                            stage("Saving instant-start state");
                            snap.captureWhenIdle(Module, 250, 20000, {
                                inputOpenBefore: window.BW_INPUT_OPEN === true,
                                pendingInput: (function () { try { return Module.getPendingInputCount ? Module.getPendingInputCount() : -1; } catch (e) { return -1; } })(),
                            }).then(function (r) {
                                fireReady(r.copied ? "cold-captured" : "cold-" + (r.reason || "nocapture"), r);
                            }, function (e) {
                                fireReady("cold-error", { error: String(e) });
                            });
                        });
                    }
                } else {
                    // no snapshot layer at all: ready as soon as the console renders
                    var onLit = function () { window.removeEventListener("boxedwine-console-lit", onLit); fireReady("nosnap", null); };
                    if (window.BW_CONSOLE_VISIBLE_AT) fireReady("nosnap", null); else window.addEventListener("boxedwine-console-lit", onLit);
                }
                Module["removeRunDependency"]("setupBoxedWine");
            };
            if (window.BWSnapshot && window.BWSnapshot._ready) {
                window.BWSnapshot._ready.then(proceed, proceed);
            } else {
                proceed();
            }
        }
        var initialSetup = function(){
            console.log("running initial setup");
            // restore: fault the fresh heap in while the zips load
            if (Module.noInitialRun && window.BWSnapshot && window.BWSnapshot.prefault) window.BWSnapshot.prefault(Module);
            setConfiguration();
            if (Config.emEnvProps.length > 0) {
            	Config.emEnvProps.forEach(function(prop){
            		ENV[prop.key] = prop.value;
            	});
            }
            Module["addRunDependency"]("setupBoxedWine");
            initBrowserFilesystem(() => {
	        	buildExtraFileSystems(() => {
    	        	buildAppFileSystem(() => {
    	            	if (window.bwBootStage) window.bwBootStage("Loading system image");
    	            	loadFile(Config.locateRootBaseUrl, Config.rootZipFile, (rootZipfileBytes) => {
    	            	    // MEMFS adopts the buffer (no 60MB copy); nothing writes to it afterwards
    	            	    createFile("/", Config.rootZipFile, rootZipfileBytes, true);
    	            	    // masm-editor: size the guest console to this iframe (cold boot only:
    	            	    // a restore brings its own /root and is resized to the panel later)
    	            	    if (typeof window.bwPatchGuestConsole === "function" && !Module.noInitialRun) {
    	            	        window.bwPatchGuestConsole(rootZipfileBytes, buildBrowserFileSystem);
    	            	    } else {
                        	    buildBrowserFileSystem();
    	            	    }
						});
                	});
	        	});
	        });
        }
        function getEmulatorParams() {        
            let params = ["-root", ROOT];
            // every guest program runs as root: Boxedwine lets other users write only under /tmp, /var and /home
            params.push("-uid");
            params.push("0");
            params.push("-euid");
            params.push("0");
            params.push("-zip");
    		params.push(Config.rootZipFile);
    		
            if(Config.extraZipFiles.length > 0){
                for(let i = 0; i < Config.extraZipFiles.length; i++) {
		            params.push("-zip");
    				params.push(Config.extraZipFiles[i]);
                }
            }    		
            if(Config.extraPayload.length > 0){
		        params.push("-zip");
    			params.push("overlay.zip");
            }
            
            if (Config.appZipFile.length > 0) { // -mount $appZipFile "/home/username/files/"
    			params.push("-mount");
    			params.push(Config.appZipFile);
    			params.push(Config.appDirPrefix);          
			} else if (Config.appPayload.length > 0){ // -mount "app.zip" "/home/username/files/" 			
    			params.push("-mount");
    			params.push(Config.payloadZipFile);
    			params.push(Config.appDirPrefix);          			
            }
                        
            params.push("-mount"); // -mount "/d_drive" "/home/username/.wine/drive_d"
            params.push(Config.d_drive);
            params.push(Config.d_drive_guest);
            
            if (Config.resolution != null) {
            	params.push("-resolution");
            	params.push(Config.resolution);
            }
            if (Config.ddrawOverridePath != null) {
            	params.push("-ddrawOverride");
            	params.push(Config.ddrawOverridePath);
            }
            if (Config.frameSkip != "0") {
            	params.push("-skipFrameFPS");
            	params.push(Config.frameSkip);
			}            
            
            if(!Config.isSoundEnabled){
                params.push("-nosound");
            }
            if(Config.audioFreq != DEFAULT_AUDIO_FREQ){
                params.push("-audioFreq");
                params.push("" + Config.audioFreq);
            }
            if (Config.disableHideCursor) {
                params.push("-disableHideCursor");
            }
            if(Config.bpp != DEFAULT_BPP){
                params.push("-bpp");
                params.push("" + Config.bpp);
            }
            if(Config.cpu.length > 0){
                params.push("-" + Config.cpu);
            }
            if(Config.envProp.length > 0){
                params.push("-env");
                params.push(Config.envProp);
            }
            // extra guest environment (boxedwine.html: LC_CTYPE, ?bwwinedebug=...)
            if (Array.isArray(window.BW_EXTRA_ENV)) {
                window.BW_EXTRA_ENV.forEach(function (e) { params.push("-env"); params.push(String(e)); });
            }

			if (!Config.loadDesktop) {
            	if(Config.WorkingDir.length > 0){
                	params.push("-w");
                	params.push(Config.WorkingDir);
            	}else if(Config.appPayload.length > 0 && Config.Program.length > 0 && Config.Program.substring(0 ,1) != "/"){
                	params.push("-w");
                	params.push(Config.appDirPrefix);
            	}else if(Config.appZipFile.length > 0 && Config.Program.length > 0 && Config.Program.substring(0 ,1) != "/"){
                	params.push("-w");
                	if (Config.appSubfolder.length > 0) {
                		params.push(Config.appDirPrefix + "/" + Config.appSubfolder);                
                	} else {
                		params.push(Config.appDirPrefix);
                	}
            	}
            }
        	params.push("/bin/wine");
            if(Config.Program.length > 0 && !Config.loadDesktop){
                if (Config.Program.endsWith('.bat')) {
                    params.push("cmd");
                    params.push("/c");
                }
                params.push(Config.Program);
                for (let i = 0; i < Config.ProgramArgs.length; i++) {
                    params.push(Config.ProgramArgs[i]);
                }
            }else{
	            params.push("explorer");
    	        params.push("/desktop=shell");
            }
            if (window.BW_DEBUG_LOG) console.log("Emulator params:" + params);
            return params;
        }
      // A program the user ran was ended by Wine: "wine: Unhandled <exception>, starting
      // debugger..." (no debugger is configured), or for a stack overflow only
      // "<tid>:err:virtual:virtual_setup_exception stack overflow ...". The app shows the
      // reason and a hint keyed by `kind`; for an illegal instruction it also gets the
      // bytes at the address, which the app decodes to name the instruction.
      function bwProgramCrashed(text) {
        var m = /^wine: (Unhandled [^,]*?)(?:, starting debugger\.\.\.)?\s*$/.exec(text);
        var reason = m && m[1], kind = "other";
        if (m) {
          if (/page fault/.test(reason)) kind = "fault";
          else if (/stack overflow/.test(reason)) kind = "stack";
          else if (/division by zero/.test(reason)) kind = "divzero";
          else if (/privileged instruction/.test(reason)) kind = "privileged";
          else if (/instruction/.test(reason)) kind = "illegal";
        } else if (/^[0-9a-f]+:err:virtual:virtual_setup_exception stack overflow \d+ bytes in thread/.test(text)) {
          reason = "stack overflow"; kind = "stack";
        }
        if (!reason) return;
        console.warn("[bw] program crashed: " + reason); // boot-log style, kept in production
        var detail = { reason: reason, kind: kind, build: window.BW_BUILD_ID, runtime: window.BW_USE_MT ? "mt" : "st" };
        if (kind === "illegal") bwInvalidOpcodeAt(reason, detail);
        else if (kind === "fault") bwPrivilegedAt(detail);
        try { window.dispatchEvent(new CustomEvent("program-crashed", { detail: detail })); } catch (e) {}
        try { window.bwHost.post("program-crashed", detail); } catch (e) {}
      }
      // the bytes at the address Wine names, from the emulator's last invalid-opcode faults
      // (Module.bwInvalidOpcodes: "<address> <bytes>" per line, oldest first, hex)
      function bwInvalidOpcodeAt(reason, detail) {
        var at = /at address ([0-9A-Fa-f]+)/.exec(reason);
        if (!at || typeof Module.bwInvalidOpcodes !== "function") return;
        try {
          var lines = Module.bwInvalidOpcodes().split("\n");
          for (var i = lines.length - 1; i >= 0; i--) {
            var f = lines[i].split(" ");
            if (f.length === 2 && f[1] && parseInt(f[0], 16) === parseInt(at[1], 16)) {
              detail.address = f[0];
              detail.bytes = f[1];
              return;
            }
          }
        } catch (e) {}
      }
      // A privileged instruction Wine does not name (LGDT, LMSW, CLTS, RDMSR, WRMSR, RDPMC, INVD,
      // WBINVD...) is reported as a read of FFFFFFFF; the emulator's log marks the address
      function bwPrivilegedAt(detail) {
        var at = /page fault on read access to FFFFFFFF at address ([0-9A-Fa-f]+)/.exec(detail.reason);
        if (!at || typeof Module.bwInvalidOpcodes !== "function") return;
        try {
          var lines = Module.bwInvalidOpcodes().split("\n");
          for (var i = lines.length - 1; i >= 0; i--) {
            var f = lines[i].split(" ");
            if (f.length === 3 && f[2] === "privileged" && parseInt(f[0], 16) === parseInt(at[1], 16)) {
              detail.kind = "privileged";
              detail.reason = "Unhandled privileged instruction at address " + at[1];
              detail.address = f[0];
              detail.bytes = f[1];
              return;
            }
          }
        } catch (e) {}
      }
      // A WebAssembly trap or an abort() stops the emulator for good (its main loop or a
      // pthread threw): the app is told at once instead of by the freeze detector seconds
      // later. A pthread's error reaches this page as the worker's ErrorEvent.
      var bwEmulatorCrashed = false;
      function bwReportEmulatorCrash(msg, error) {
        var text = String((error && error.message) || msg || "");
        var trap = (typeof WebAssembly !== "undefined" && error instanceof WebAssembly.RuntimeError) || /RuntimeError|Aborted\(/.test(text);
        if (!trap || bwEmulatorCrashed) return;
        bwEmulatorCrashed = true;
        var detail = { message: text.slice(0, 500), stack: String((error && error.stack) || "").slice(0, 2000), build: window.BW_BUILD_ID, runtime: window.BW_USE_MT ? "mt" : "st" };
        console.error("[bw] emulator crashed: " + detail.message); // boot-log style, kept in production
        try { window.bwHost.post("emulator-crashed", detail); } catch (e) {}
      }
      var Module = {
        preRun: [initialSetup],
        arguments: [],
        postRun: [],
        // an emulator panic: the emulator aborts right after, this reports its text
        bwOnPanic: function(text) { bwReportEmulatorCrash("Aborted(" + text + ")", null); },
        print: (function() {
          // guest stdout reaches the browser console only with ?bwlog=1; the last MAX
          // lines are kept in window.BW_GUEST_LOG
          var MAX = 2000, log = window.BW_GUEST_LOG = [];
          return function(text) {
            text = Array.prototype.slice.call(arguments).join(' ');
            if (window.BW_DEBUG_LOG) console.log(text);
            bwProgramCrashed(text);
            log.push(text);
            if (log.length > MAX) log.splice(0, log.length - MAX);
          };
        })(),
        printErr: function(text) {
          text = Array.prototype.slice.call(arguments).join(' ');
          bwProgramCrashed(text);
          if (0) { // XXX disabled for safety typeof dump == 'function') {
            dump(text + '\n'); // fast, straight to the real console
          } else {
			console.error(text);
          }
        },
        canvas: (function() {
          var canvas = document.getElementById('canvas');

          // As a default initial behavior, pop up an alert when webgl context is lost. To make your
          // application robust, you may want to override this behavior before shipping!
          // See http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.15.2
          // alert() is blocked in the sandboxed webview: the extension shows a notification
          canvas.addEventListener("webglcontextlost", function(e) { try { window.bwHost.post("webgl-context-lost", {}); } catch (_) {} e.preventDefault(); }, false);
          canvas.width  = 800;
          canvas.height = 600;
          return canvas;
        })(),
        setStatus: function(text) {
          // the app shows its own loading screen; logged for debugging only
          if (window.BW_DEBUG_LOG && text) console.log("[emscripten] " + text);
        },
        totalDependencies: 0,
        monitorRunDependencies: function(left) {
          this.totalDependencies = Math.max(this.totalDependencies, left);
          Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')' : '');
        }
      };
      Module.setStatus('Downloading...');
      window.onerror = function(msg, file, line, column, error) {
        bwReportEmulatorCrash(msg, error);
        Module.setStatus('Exception thrown, see JavaScript console');
        console.log(msg, file, line, column, error);
        Module.setStatus = function(text) {
          if (text) Module.printErr('[post-exception status] ' + text);
        };
      };
// canOwn: MEMFS adopts buf instead of copying it (the caller must not modify it afterwards)
function createFile(dir, name, buf, canOwn) {
    try {
        FS.createDataFile(dir, name, buf, true, true, !!canOwn);
        console.log("File created:" + dir + "/" + name);
    } catch(e) {
        console.log("Unable to create file:" + dir + "/" + name + "  error:" + e);
    }
}
function getParameter(inputKey) {
    var retVal="";
    var replacementParameters = Config.urlParams;
    var url = replacementParameters.length > 0 ? "?" + replacementParameters : window.location.href;
    var index = url.indexOf("?")+1;
    if(index > 0){
        var paramStr = url.substring(index);
        var params = paramStr.split("&");
        for(var x=0;x<params.length;x++){
            var param = params[x];
            var separator = param.indexOf("=");
            var key = separator >= 0 ? param.substring(0, separator) : param;
            if(key === inputKey){
                retVal = separator >= 0 ? param.substring(separator + 1) : "";
                break;
            }
        }
    }
    var hashIndex = retVal.lastIndexOf('#');
    if(hashIndex > 0 ) {
        retVal = retVal.substring(0, hashIndex);
    }
    return retVal;
}
function decodeUrlValue(value) {
    try {
        return decodeURIComponent(value.replace(/\+/g, " "));
    } catch (e) {
        return value.split("%20").join(" ");
    }
}
function splitCommandLine(value) {
    let result = [];
    let current = "";
    let quote = "";
    for (let i = 0; i < value.length; i++) {
        let c = value[i];
        if (quote.length > 0) {
            if (c === quote) {
                quote = "";
            } else {
                current += c;
            }
        } else if (c === '"' || c === "'") {
            quote = c;
        } else if (/\s/.test(c)) {
            if (current.length > 0) {
                result.push(current);
                current = "";
            }
        } else {
            current += c;
        }
    }
    if (current.length > 0) {
        result.push(current);
    }
    return result;
}
/** code from https://github.com/Rob--W/zipinfo.js MIT license
 **/
function getZipEntries(data) {
  var view = new DataView(data.buffer, data.byteOffset, data.length);
  var entriesLeft = 0;
  var offset = 0;
  var endoffset = data.length;
  // Find EOCD (0xFFFF is the maximum size of an optional trailing comment).
  for (var i = data.length - 22, ii = Math.max(0, i - 0xFFFF); i >= ii; --i) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b &&
      data[i + 2] === 0x05 && data[i + 3] === 0x06) {
        endoffset = i;
        offset = view.getUint32(i + 16, true);
        entriesLeft = view.getUint16(i + 8, true);
        break;
      }
  }
  var entries = [{
    directory: true,
    filename: '/',
    uncompressedSize: 0,
    centralDirectoryStart: offset,
  }];
  if (offset >= data.length || offset <= 0) {
    // EOCD not found or malformed. Try to recover if possible (the result is
    // most likely going to be incomplete or bogus, but we can try...).
    offset = -1;
    entriesLeft = 0xFFFF;
    while (++offset < data.length && data[offset] !== 0x50 &&
      data[offset + 1] !== 0x4b && data[offset + 2] !== 0x01 &&
        data[offset + 3] !== 0x02);
  }
  endoffset -= 46;  // 46 = minimum size of an entry in the central directory.
  while (--entriesLeft >= 0 && offset < endoffset) {
    if (view.getUint32(offset) != 0x504b0102) {
      break;
    }
    var bitFlag = view.getUint16(offset + 8, true);
    var uncompressedSize = view.getUint32(offset + 24, true);
    var fileNameLength = view.getUint16(offset + 28, true);
    var extraFieldLength = view.getUint16(offset + 30, true);
    var fileCommentLength = view.getUint16(offset + 32, true);
    var filename = data.subarray(offset + 46, offset + 46 + fileNameLength);
    var utfLabel = (bitFlag & 0x800) ? 'utf-8' : 'ascii';
    filename = new TextDecoder(utfLabel).decode(filename);
    entries.push({
      directory: filename.endsWith('/'),
      filename: filename,
      uncompressedSize: uncompressedSize,
    });
    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }
  return entries;
};
