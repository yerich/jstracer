textureData = {};
normalMapData = {};

function drawImage(data) {
    var c = document.getElementById("render");
    var ctx = c.getContext("2d");

    var width = c.width;
    var height = c.height;
    var canvasData = ctx.getImageData(0, 0, width, height);
    var d = data;
    var renderStart;
    var renderEnd = false;
    var workers = [];
    var workerOutstandingMessages = [];
    var perlinNeeded = false;

    var findPrimitive = function(primitives, id) {
        for (var i in primitives) {
            if (primitives[i].id == id) return primitives[i];
        }
    };

    var initPrimitiveMTrans = function(primitive) {
        primitive.mTrans = m4();
        primitive.mTransNoScale = m4();
        primitive.mTransRotateAndInvScale = m4();
        primitive.mTransNoTranslate = m4();
        primitive.mTransScaleOnly = m4();
    }

    var makeUniformModelGrid = function(model) {
        model.gridCount = Math.min(2, Math.round(Math.pow(model.triangles.length / 50, 1/3)));
        
        if (model.gridCount <= 1)
            return;
        
        model.partitions = [];
        model.hasPartitions = true;
        var boundsDiff = [model.bounds[1][0] - model.bounds[0][0],
                          model.bounds[1][1] - model.bounds[0][1],
                          model.bounds[1][2] - model.bounds[0][2]];
        
        var gridCount = model.gridCount;
        for (var x = 0; x < gridCount; x++) {
            for (var y = 0; y < gridCount; y++) {
                for (var z = 0; z < gridCount; z++) {
                    var i = x * gridCount * gridCount + y * gridCount + z;

                    var partition = {
                        type: "model",
                        id: model.id + "_partition"+i
                    };
                    
                    partition.bounds = [
                        [model.bounds[0][0] + (x / gridCount) * boundsDiff[0],
                         model.bounds[0][1] + (y / gridCount) * boundsDiff[1],
                         model.bounds[0][2] + (z / gridCount) * boundsDiff[2]],
                        [model.bounds[0][0] + ((x + 1) / gridCount) * boundsDiff[0],
                         model.bounds[0][1] + ((y + 1) / gridCount) * boundsDiff[1],
                         model.bounds[0][2] + ((z + 1) / gridCount) * boundsDiff[2]],
                    ];

                    partition.triangles = [];
                    for (var t in model.triangles) {
                        var tri = model.triangles[t];
                        for (var v = 1; v <= 3; v++) {
                            if (tri["v"+v][0] >= partition.bounds[0][0] - e && tri["v"+v][0] <= partition.bounds[1][0] + e &&
                                    tri["v"+v][1] >= partition.bounds[0][1] - e && tri["v"+v][1] <= partition.bounds[1][1] + e &&
                                    tri["v"+v][2] >= partition.bounds[0][2] - e && tri["v"+v][2] <= partition.bounds[1][2] + e) {
                                partition.triangles.push(tri);
                                tri.used = true;
                                break;
                            }
                        }
                    }
                    
                    partition.bounds = [[1000000000, 1000000000, 1000000000], [-1000000000, -1000000000, -1000000000]];
                    for (var j in partition.triangles) {
                        for (var t = 1; t <= 3; t++) {
                            for (var c = 0; c < 3; c++) {
                                if (partition.triangles[j]["v"+t][c] < partition.bounds[0][c])
                                    partition.bounds[0][c] = partition.triangles[j]["v"+t][c];
                                else if (partition.triangles[j]["v"+t][c] > partition.bounds[1][c])
                                    partition.bounds[1][c] = partition.triangles[j]["v"+t][c];
                            }
                        }
                    }

                    if (partition.triangles.length > 0) {
                        model.partitions.push(partition);
                        if (partition.triangles.length < model.triangles.length - 5)
                            makeUniformModelGrid(partition);
                    }
                    else 
                        model.partitions.push(false);
                }
            }
        }

        delete model.triangles;
    };
    
    // Note: after preprocessing, spheres and boxes (except bounding boxes) are defined in model space with a transformation,
    // while planes and triangles have their coordinates converted into world space.
    var preprocessPrimitives = function(primitives, transformations) {
        // Initialize Transformation Matrices
        for (var i in primitives) {
            var primitive = primitives[i];
            if (!primitive.mTrans) {
                initPrimitiveMTrans(primitive);
            }
            if (primitive.reflection) {
                primitive.reflectionInv = vSub([1, 1, 1], primitive.reflection);
            }
            if (primitive.refraction) {
                primitive.refractionInv = vSub([1, 1, 1], primitive.refraction);
            }

            //set to true if we need to return the hit point in model coordinates when intersecting
            primitive.requiresMapping = false;  

            // Some texture processing to get height/width factors
            if (primitive.texture) {
                if (!primitive.textureMappedWidth)
                    primitive.textureMappedWidth = 1;
                if (!primitive.textureMappedHeight)
                    primitive.textureMappedHeight = 1;

                var texture = textureData[primitive.texture];
                primitive.textureWidthFactor = texture.width / primitive.textureMappedWidth;
                primitive.textureHeightFactor = texture.height / primitive.textureMappedHeight;
                primitive.requiresMapping = true;
            }
            if (primitive.perlinTexture) {
                if (!primitive.perlinTextureDimensions)
                    primitive.perlinTextureDimensions = [10, 10, 10]
                primitive.requiresMapping = true;
                perlinNeeded = true;
            }
            if (primitive.bumpMap && flags["BUMP_MAPPING"]) {
                primitive.requiresMapping = true;

                if (!primitive.bumpMapMappedWidth)
                    primitive.bumpMapMappedWidth = 1;
                if (!primitive.bumpMapMappedHeight)
                    primitive.bumpMapMappedHeight = 1;

                var bumpMap = normalMapData[primitive.bumpMap];
                primitive.bumpMapWidthFactor = bumpMap.width / primitive.bumpMapMappedWidth;
                primitive.bumpMapHeightFactor = bumpMap.height / primitive.bumpMapMappedHeight;
            }

            if (primitive.type === "sphere" && !primitive.radius) {
                primitive.radius = 1;
                primitive.center = [0, 0, 0];
            }
            else if (primitive.type === "plane") {
                primitive.normal = [0, 1, 0];
                primitive.right = [1, 0, 0];
                primitive.point = [0, 0, 0];
            }
            else if (primitive.type === "box") {
                primitive.bounds = [[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]];
            }
            else if (primitive.type === "model") {
                if (!primitive.triangles)
                    primitive.triangles = [];
                
                // Generate triangles from blender-style raw triangle strings
                if (primitive.modelFile) {
                   primitive.triangleRawString = d.modelData[primitive.modelFile];
                }

                if (primitive.triangleRawString) {
                    var triangles = primitive.triangleRawString.split(" ");
                    primitive.triangles = [];
                    for (var j = 0; j < triangles.length; j++) triangles[j] = parseFloat(triangles[j]);
                    for (var j = 0; j < triangles.length; j += 9) {
                        if (typeof triangles[j] === "undefined") continue;
                        primitive.triangles.push([[triangles[j], triangles[j+1], triangles[j+2]], 
                                                   [triangles[j+3], triangles[j+4], triangles[j+5]],
                                                   [triangles[j+6], triangles[j+7], triangles[j+8]]]);
                    }

                    primitive.triangleRawString = "";
                }
            }
        }
    
        // Apply transformations to the matrices
        for (var i in transformations) {
            var t = transformations[i];
            var primitive = findPrimitive(primitives, t.target);
            if (!primitive) continue;

            if (t.type === "translate") {
                primitive.mTrans = mTranslate(t.amount[0], t.amount[1], t.amount[2], primitive.mTrans);
                primitive.mTransNoScale = mTranslate(t.amount[0], t.amount[1], t.amount[2], primitive.mTransNoScale);
            }
            else if (t.type === "scale") {
                primitive.mTrans = mScale(t.amount[0], t.amount[1], t.amount[2], primitive.mTrans);
                primitive.mTransNoTranslate = mScale(t.amount[0], t.amount[1], t.amount[2], primitive.mTransNoTranslate);
                primitive.mTransRotateAndInvScale = mScale(1/t.amount[0], 1/t.amount[1], 1/t.amount[2], primitive.mTransRotateAndInvScale);
                primitive.mTransScaleOnly = mScale(1/t.amount[0], 1/t.amount[1], 1/t.amount[2], primitive.mTransScaleOnly);
            }
            else if (t.type === "rotate") {
                primitive.mTrans = mRotate(t.axis, t.amount, primitive.mTrans);
                primitive.mTransNoTranslate = mRotate(t.axis, t.amount, primitive.mTransNoTranslate);
                primitive.mTransNoScale = mRotate(t.axis, t.amount, primitive.mTransNoScale);
                primitive.mTransRotateAndInvScale = mRotate(t.axis, t.amount, primitive.mTransRotateAndInvScale);
            }
        }
        
        // Planes, triangles and boxes can have the transformations applied to their points
        // immediately to save computation time later.
        for (var i in primitives) {
            var primitive = primitives[i];
            if (primitive.type === "plane") {
                primitive.normal = m4Multv3(primitive.mTransNoTranslate, primitive.normal);
                primitive.right = m4Multv3(primitive.mTransNoTranslate, primitive.right);
                primitive.away = vCross3(primitive.normal, primitive.right);
                primitive.point = m4Multv3(primitive.mTransNoScale, primitive.point);
            }
            else if (primitive.type === "triangle") {
                primitive.v1 = m4Multv3(primitive.mTrans, primitive.v1);
                primitive.v2 = m4Multv3(primitive.mTrans, primitive.v2);
                primitive.v3 = m4Multv3(primitive.mTrans, primitive.v3);

                primitive.e1 = v3Sub(primitive.v2, primitive.v1);
                primitive.e2 = v3Sub(primitive.v3, primitive.v1);
                primitive.normal = vNormalize(vCross3(primitive.e1, primitive.e2));
            }
            else if (primitive.type === "model") {
                for (var j in primitive.triangles) {
                    primitive.triangles[j] = {
                        v1: primitive.triangles[j][0],
                        v2: primitive.triangles[j][1],
                        v3: primitive.triangles[j][2],
                        type: "triangle",
                        mTrans: primitive.mTrans,
                        mTransNoScale: primitive.mTransNoScale,
                        mTransNoTranslate: primitive.mTransNoTranslate,
                        mTransRotateAndInvScale: primitive.mTransRotateAndInvScale,
                        requiresMapping: primitive.requiresMapping,
                        perlinTexture: primitive.perlinTexture,
                        perlinTextureDimensions: primitive.perlinTextureDimensions,
                        perlinTextureMode: primitive.perlinTextureMode
                    };
                }

                preprocessPrimitives(primitive.triangles, []);
                primitive.bounds = [[1000000000, 1000000000, 1000000000], [-1000000000, -1000000000, -1000000000]];
                
                for (var j in primitive.triangles) {
                    for (var t = 1; t <= 3; t++) {
                        for (var c = 0; c < 3; c++) {
                            if (primitive.triangles[j]["v"+t][c] < primitive.bounds[0][c])
                                primitive.bounds[0][c] = primitive.triangles[j]["v"+t][c];
                            else if (primitive.triangles[j]["v"+t][c] > primitive.bounds[1][c])
                                primitive.bounds[1][c] = primitive.triangles[j]["v"+t][c];
                        }
                    }
                }

                makeUniformModelGrid(primitive);
            }

            // The primitive's corrdinates have been coverted to world space, so there's no future
            // need to convert them any further.
            if (primitive.type === "plane" || primitive.type === "triangle") {
                primitive.mTrans = m4();
                primitive.mTransNoTranslate = m4();
                primitive.mTransNoScale = m4();
                primitive.mTransRotateAndInvScale = m4();
                primitive.mTransScaleOnly = m4();
            }

            primitive.mTransScaleOnlyInv = m4Inverse(primitive.mTransScaleOnly);
        }
    };

    function writePixel(x, y, r, g, b, a) {
        var index = (x + y * width) * 4;

        // Random dithering
        if (ENABLE_DITHERING) {
            for (var i = 0; i < 3; i++) {
                canvasData.data[index + 0] = Math.floor(r) + (Math.random() < (r - Math.floor(r)));
                canvasData.data[index + 1] = Math.floor(g) + (Math.random() < (g - Math.floor(g)));
                canvasData.data[index + 2] = Math.floor(b) + (Math.random() < (b - Math.floor(b)));
            }
        }
        else {
            canvasData.data[index + 0] = r;
            canvasData.data[index + 1] = g;
            canvasData.data[index + 2] = b;
        }
        canvasData.data[index + 3] += a;
    }

    function clearPixel(x, y) {
        var index = (x + y * width) * 4;
        canvasData.data[index + 0] = 0;
        canvasData.data[index + 1] = 0;
        canvasData.data[index + 2] = 0;
        canvasData.data[index + 3] = 0;
    }

    function clearCanvas() {
        for (var i = 0; i < (height * width) * 4; i++)
            canvasData.data[i] = 0;
    }

    function updateCanvas() {
        ctx.putImageData(canvasData, 0, 0);
    }

    function updateTimer() {
        if (renderEnd) {
            $("#timer").text(renderEnd - renderStart);
        }
        else {
            var time = +new Date();
            $("#timer").text(time - renderStart);
        }
    }

    function checkWorkerTimers(workerOutstandingMessages) {
        for (var i in workerOutstandingMessages) {
            if (workerOutstandingMessages[i] > 0) return false;
        }
        renderEnd = +new Date();
    }

    function getEdges() {
        var pixelDiff = [];
        for (var y = 0; y < height; y++) {
            pixelDiff[y] = [];
            for (var x = 0; x < width; x++) {
                var index = (x + y * width) * 4;
                pixelDiff[y][x] = 0;

                for (var i = 0; i < 3; i++) {
                    if (x < width - 1)
                        pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index + 4 + i]);
                    if (x > 0)
                        pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index - 4 + i]);
                    if (y < height - 1)
                        pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index + (4 * height) + i]);
                    if (y > 0)
                        pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index - (4 * height) + i]);

                    // With soft shadows on, we must be more sensitive in our edge detection algorithm
                    if (flags["SOFT_SHADOWS"]) {
                        if (x < width - 1 && y < height - 1)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index + (4 * height) + 4 + i]) / 2;
                        if (x < width - 1 && y > 0)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index - (4 * height) + 4 + i]) / 2;
                        if (x > 0 && y < height - 1)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index + (4 * height) - 4 + i]) / 2;
                        if (x > 0 && y > 0)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index - (4 * height) - 4 + i]) / 2;

                        if (x < width - 2)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index + 8 + i]) / 2;
                        if (x > 1)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index - 8 + i]) / 2;
                        if (y < height - 2)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index + (8 * height) + i]) / 2;
                        if (y > 1)
                            pixelDiff[y][x] += Math.abs(canvasData.data[index + i] - canvasData.data[index - (8 * height) + i]) / 2;
                    }
                }
            }
        }

        if (flags["SOFT_SHADOWS"]) {
            var origPixelDiff = [];
            for (var y = 0; y < height; y++) {
                origPixelDiff[y] = [];
                for (var x = 0; x < width; x++) {
                    origPixelDiff[y][x] = pixelDiff[y][x];
                }
            }

            // Smooth out pixelDiff
            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    if (pixelDiff[y][x] < flags["MULTISAMPLING_THRESHOLD"]) {
                        if (x < width - 1) pixelDiff[y][x+1] += origPixelDiff[y][x] / 2;
                        if (x > 0) pixelDiff[y][x-1] += origPixelDiff[y][x] / 2;
                        if (y < height - 1) pixelDiff[y+1][x] += origPixelDiff[y][x] / 2;
                        if (y > 0) pixelDiff[y-1][x] += origPixelDiff[y][x] / 2;
                        if (x < width - 1 && y < height - 1) pixelDiff[y+1][x+1] += origPixelDiff[y][x] / 4;
                        if (x < width - 1 && y > 0) pixelDiff[y-1][x+1] += origPixelDiff[y][x] / 4;
                        if (x > 0 && y < height - 1) pixelDiff[y+1][x-1] += origPixelDiff[y][x] / 4;
                        if (x > 0 && y > 0) pixelDiff[y-1][x-1] += origPixelDiff[y][x] / 4;
                        if (x < width - 2) pixelDiff[y][x+2] += origPixelDiff[y][x] / 4;
                        if (x > 2) pixelDiff[y][x-2] += origPixelDiff[y][x] / 4;
                        if (y < height - 2) pixelDiff[y+2][x] += origPixelDiff[y][x] / 4;
                        if (y > 2)  pixelDiff[y-2][x] += origPixelDiff[y][x] / 4;
                    }
                }
            }

            for (var y = 0; y < height; y++) {
                origPixelDiff[y] = [];
                for (var x = 0; x < width; x++) {
                    origPixelDiff[y][x] = pixelDiff[y][x];
                }
            }

            // Fill in pixelDiff holes
            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    if (pixelDiff[y][x] < flags["MULTISAMPLING_THRESHOLD"]) {
                        var flipThreshold = 4;
                        var thresholdNeighbours = 0
                        if (x < width - 1 && origPixelDiff[y][x+1] > flags["MULTISAMPLING_THRESHOLD"]) thresholdNeighbours++;
                        if (x > 0 && origPixelDiff[y][x-1] > flags["MULTISAMPLING_THRESHOLD"]) thresholdNeighbours++;
                        if (y < height - 1 && origPixelDiff[y+1][x] > flags["MULTISAMPLING_THRESHOLD"]) thresholdNeighbours++;
                        if (y > 0 && origPixelDiff[y-1][x] > flags["MULTISAMPLING_THRESHOLD"]) thresholdNeighbours++;

                        if (thresholdNeighbours >= flipThreshold) {
                            pixelDiff[y][x] += flags["MULTISAMPLING_THRESHOLD"];
                        }
                    }
                }
            }
        }

        d.pixelDiff = pixelDiff;
    }

    // Returns an event handler for a rendering worker
    var workerMessageHandler = function(workerNum) {
        var lineSkip = Math.round(flags['WORKER_CHUNK_PIXELS'] / width);;
        return function(e) {
            var i = workerNum;
            workerOutstandingMessages[i]--;
            checkWorkerTimers(workerOutstandingMessages);
            updateTimer();

            if (e.data.action === "getPixels") {
                for (var p in e.data.pixels) {
                    var pixel = e.data.pixels[p];
                    writePixel(pixel.x, pixel.y, pixel.color[0], pixel.color[1], pixel.color[2], 255);
                }

                if (e.data.pixels[0].y % lineSkip == 0 || e.data.pixels[0].y > height - 1 - (flags['NUM_WORKERS'] * lineSkip))
                    updateCanvas();

                if (renderEnd) {
                    if (flags["MULTISAMPLING"]) {
                        getEdges();
                        var aaPixels = [];
                        // Get which pixels need to be anti-aliased
                        for (var y = 0; y < height; y++) {
                            for (var x = 0; x < width; x++) {
                                if (d.pixelDiff[y][x] > flags["MULTISAMPLING_THRESHOLD"]) {
                                    aaPixels.push([x, y]);
                                    if (flags["MULTISAMPLING_ADAPTIVE_HIGHLIGHT"])
                                        writePixel(x, y, 255, 255, 255, 255);
                                }
                            }
                        }
                        updateCanvas();

                        // divide target pixels into chunks which get sent as messages to workers.
                        messages = [];
                        for (var i = 0, count = 0; i < aaPixels.length; i += flags['WORKER_AA_CHUNK_PIXELS'], count++) {
                            messages[count] = {
                                action: "getAntialiasedPixels",
                                coords: aaPixels.slice(i, i + flags['WORKER_AA_CHUNK_PIXELS'])
                            }
                        }

                        for (var i in messages) {
                            var w = i % 4;
                            workerOutstandingMessages[w]++;
                            workers[w].postMessage(messages[i]);
                        }
                    }

                    renderEnd = 0;
                }
            }
            else if (e.data.action === "getAntialiasedPixels") {
                for (var i in e.data.pixels) {
                    var pixel = e.data.pixels[i];
                    writePixel(pixel.x, pixel.y, pixel.color[0], pixel.color[1], pixel.color[2], 255);
                }
                updateCanvas();
            }
        };
    }

    // Generates an image of the scene defined by d, and writes it to the target canvas
    function writePixels() {
        clearCanvas();

        var aspectRatio = width / height;
        var fov = 40;
        var max_x = Math.tan(degToRad(fov));
        var max_y = max_x / aspectRatio;
        d.camera.right = vNormalize(vCross3(d.camera.direction, d.camera.up));
        // Start render timer
        renderStart = +new Date();
        console.log("max_x is " + max_x + ". max_y is " + max_y);

        if (flags['USE_WORKERS']) {
            // Multi-threaded renderer -- render using WebWorkers API
            var lineSkip = Math.round(flags['WORKER_CHUNK_PIXELS'] / width);
            
            for (var i = 0; i < flags['NUM_WORKERS']; i++) {
                if (!workers[i])
                    workers[i] = new Worker("worker.js");

                workerOutstandingMessages[i] = 0;
                // Send message to worker telling them the scene, textures, other parameters
                workers[i].postMessage({action: "setD", d: JSON.stringify(d), max_x: max_x, max_y : max_y, width: width, height: height, textureData: textureData, normalMapData: normalMapData});
                workers[i].onmessage = workerMessageHandler(i);
            }

            // Allocate lines for each worker to render
            for (var y = 0; y < height; y += lineSkip) {
                var rays = [];
                var workerNum = (y / lineSkip) % flags['NUM_WORKERS']

                postMessageCalls++;
                workers[workerNum].postMessage({y1: y, y2: y + lineSkip, action: "getPixels"});
                workerOutstandingMessages[workerNum]++;
            }
        }
        else {
            // Single threaded renderer -- rendering on main thread
            window.d = d;

            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    var newDir = vAdd(
                        vMult(d.camera.up, -(y / height * max_y) + (max_y/2)), 
                        vMult(d.camera.right, x / width * max_x - (max_x/2)));

                    var ray = vNormalize(vAdd(d.camera.direction, newDir));
                    var color = getColorForRay(d.camera.position, ray, 0);
                    writePixel(x, y, color[0], color[1], color[2], 255);
                }
            }


            if (flags["MULTISAMPLING"]) {
                getEdges();
                for (var y = 0; y < height; y++) {
                    for (var x = 0; x < width; x++) {
                        if (d.pixelDiff[y][x] > flags["MULTISAMPLING_THRESHOLD"]) {
                            // multisampling
                            var color = [0, 0, 0];
                            var ray, newDir;

                            var rays = getMultiSampleRays(d.camera, x, y, width, height, max_x, max_y, flags["MULTISAMPLING_AMOUNT"]);
                            for (var i = 0; i < rays.length; i++) {
                                color = vAdd(color, vMult(getColorForRay(d.camera.position, rays[i], 0), 1/flags["MULTISAMPLING_AMOUNT"]));
                            }

                            writePixel(x, y, color[0], color[1], color[2], 255);
                        }
                        //var ray = vNormalize(vAdd(d.camera.direction, [x / width * max_x - (max_x/2), -(y / height * max_y) + (max_y/2), 0]));
                        //var color = getColorForRay(d.camera.position, ray, 0);
                        //writePixel(x, y, color[0], color[1], color[2], 255);
                    }
                }
            }
            updateCanvas();

            renderEnd = +new Date();
            updateTimer();
        }

        updateCanvas();
    }

    // Loads an image file, calls callback when complete
    // http://webglfundamentals.org/webgl/lessons/webgl-2-textures.html
    var loadImage = function(url, callback) {
        var image = new Image();
        image.src = url;
        image.onload = callback;
        return image;
    }

    var loadTextures = function(urls, callback) {
        var images = [];
        var imagesToLoad = urls.length;

        // Called each time an image finished
        // loading.
        var onImageLoad = function() {
            imagesToLoad--;
            // If all the images are loaded call the callback.
            if (imagesToLoad == 0) {
                callback(images);
            }
        };

        for (var ii = 0; ii < imagesToLoad; ++ii) {
            var image = loadImage(urls[ii], onImageLoad);
            images[ii] = image;
        }
    }

    // Generates a cached hash table of Perlin noise dot grid gradient values
    var generatePerlin = function() {
        d.perlin = [];
        for (var x = 0; x < flags['PERLIN_SIZE']; x++) {
            d.perlin[x] = [];
            for (var y = 0; y < flags['PERLIN_SIZE']; y++) {
                d.perlin[x][y] = [];
                for (var z = 0; z < flags['PERLIN_SIZE']; z++) {
                    d.perlin[x][y][z] = [Math.random(), Math.random(), Math.random()];
                    while (vLen(d.perlin[x][y][z]) > 1) {
                        d.perlin[x][y][z] = [Math.random(), Math.random(), Math.random()];
                    }
                    d.perlin[x][y][z] = vNormalize(d.perlin[x][y][z]);
                }
            }
        }
    }

    // Function that calls render (and does some preparation stuff) only when models and textures loaded
    var doRender = function() {
        if (modelsLoaded && texturesLoaded && heightmapsLoaded) {
            preprocessPrimitives(d.primitives, d.transformations);

            for (var i in d.lights) {
                if (!d.lights[i].radius) d.lights[i].radius = 0;
            }

            if (perlinNeeded)
                generatePerlin();

            writePixels();
        }
    }

    // Initial processing of data files.
    // If this scene requires additional files, load them
    var modelsLoaded = true;
    var texturesLoaded = true;
    var heightmapsLoaded = true;
    if (d.models || d.textures || d.heightmaps) {
        if (d.models) {
            var modelsLoaded = false;
            d.modelData = {};
            for (var i = 0; i < d.models.length; i++) {
                (function(i) {
                    $.get("models/"+d.models[i], function(response) {
                        d.modelData[d.models[i]] = response.trim().replace(/\s+/g, " ");
                        console.log("Model loaded: "+d.models[i]);
                    });
                })(i);
            }

            $(document).ajaxStop(function () {
                modelsLoaded = true;
                doRender();
            });
        }

        if (d.textures) {
            var texturesLoaded = false;
            loadTextures(d.textures.map(function(t) { return "textures/" + t.url; }), function(images) {
                window.textureData = {};

                for (var i in images) {
                    var image = images[i];
                    
                    var canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;

                    var context = canvas.getContext('2d');
                    context.drawImage(image, 0, 0);

                    var url = d.textures[i].url;
                    window.textureData[url] = {};
                    window.textureData[url].url = d.textures[i].url;
                    window.textureData[url].width = image.width;
                    window.textureData[url].height = image.height;
                    window.textureData[url].data = context.getImageData(0, 0, image.width, image.height).data;
                    console.log("Texture loaded: " + url);

                    delete d.textures[i].data;
                };

                texturesLoaded = true;
                doRender();
            });
        }

        if (d.heightmaps && flags["BUMP_MAPPING"]) {
            var heightmapsLoaded = false;
            loadTextures(d.heightmaps.map(function(t) { return "heightmaps/" + t.url; }), function(images) {
                window.normalMapData = {};

                for (var i in images) {
                    var image = images[i];
                    
                    var canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;

                    var context = canvas.getContext('2d');
                    context.drawImage(image, 0, 0);

                    var url = d.heightmaps[i].url;
                    window.normalMapData[url] = {};
                    window.normalMapData[url].url = d.heightmaps[i].url;
                    window.normalMapData[url].width = image.width;
                    window.normalMapData[url].height = image.height;
                    
                    var heightmapImageData = context.getImageData(0, 0, image.width, image.height).data;
                    var heightmapData = [];
                    for (var y = 0; y < window.normalMapData[url].height; y++) {
                        heightmapData[y] = [];
                        for (var x = 0; x < window.normalMapData[url].width; x++) {
                            var index = (y * window.normalMapData[url].width + x) * 4;
                            heightmapData[y][x] = heightmapImageData[index];
                        }
                    }

                    window.normalMapData[url].data = heightMapToNormals(heightmapData);

                    //for (var y = 0; y < image.height; y++) {
                    //    for (var x = 0; x < image.width; x++) {
                    //        writePixel(x, y, (normalMapData[url].data[y][x][0] + 1) * 128, (normalMapData[url].data[y][x][0] + 1) * 128, (normalMapData[url].data[y][x][0] + 1) * 128, 255);
                    //    }
                    //}
                    console.log("Heightmap loaded: " + url);
                    //updateCanvas();

                    delete d.heightmaps[i].data;
                };

                heightmapsLoaded = true;
                doRender();
            });
        }
    }
    else {
        doRender();
    }

    return d;
}

$(document).ready(function() {
    $.getJSON("scenes/simple_bumpmap.json", function(d) {
        window.d = drawImage(d);
    });
});