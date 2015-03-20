e = 0.00001;
useWorkers = false;
lineSkip = 10;
numWorkers = 8;
postMessageCalls = 0;

function drawImage(data) {
    var c = document.getElementById("render");
    var ctx = c.getContext("2d");

    var width = c.width;
    var height = c.height;
    var canvasData = ctx.getImageData(0, 0, width, height);
    var d = data;

    var findPrimitive = function(primitives, id) {
        for (var i in primitives) {
            if (primitives[i].id == id) return primitives[i];
        }
    };

    var preprocessPrimitives = function(primitives, transformations) {
        for (var i in primitives) {
            var primitive = primitives[i];
            if (!primitive.mTrans) {
                primitive.mTrans = m4();
                primitive.mTransNoScale = m4();
                primitive.mTransNoTranslate = m4();
                primitive.mTransRotateAndInvScale = m4();
            }

            if (primitive.type === "sphere") {
                primitive.radius = 1;
                primitive.center = [0, 0, 0];
            }
            else if (primitive.type === "plane") {
                primitive.normal = [0, 1, 0];
                primitive.point = [0, 0, 0];
            }
            else if (primitive.type === "box") {
                primitive.bounds = [[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]];
            }
            else if (primitive.type === "model") {
                if (!primitive.triangles)
                    primitive.triangles = [];

                if (primitive.triangleRawString) {
                    var triangles = primitive.triangleRawString.split(" ");
                    primitive.triangles = [];
                    for (var j = 0; j < triangles.length; j++) triangles[j] = parseFloat(triangles[j]);
                    for (var j = 0; j < triangles.length; j += 9) {
                        primitive.triangles.push([[triangles[j], triangles[j+1], triangles[j+2]], 
                                                   [triangles[j+3], triangles[j+4], triangles[j+5]],
                                                   [triangles[j+6], triangles[j+7], triangles[j+8]]]);
                    }
                }
            }
        }

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
            }
            else if (t.type === "rotate") {
                primitive.mTrans = mRotate(t.axis, t.amount, primitive.mTrans);
                primitive.mTransNoTranslate = mRotate(t.axis, t.amount, primitive.mTransNoTranslate);
                primitive.mTransNoScale = mRotate(t.axis, t.amount, primitive.mTransNoScale);
                primitive.mTransRotateAndInvScale = mRotate(t.axis, t.amount, primitive.mTransRotateAndInvScale);
            }
        }

        for (var i in primitives) {
            var primitive = primitives[i];
            if (primitive.type === "plane") {
                primitive.normal = m4Multv3(primitive.mTransNoTranslate, [0, 1, 0]);
                primitive.point = m4Multv3(primitive.mTransNoScale, [0, 0, 0]);
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
                        mTransRotateAndInvScale: primitive.mTransRotateAndInvScale
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
            }

            if (primitive.type === "plane" || primitive.type === "triangle") {
                primitive.mTrans = m4();
                primitive.mTransNoTranslate = m4();
                primitive.mTransNoScale = m4();
                primitive.mTransRotateAndInvScale = m4();
            }
        }
    };

    function writePixel(x, y, r, g, b, a) {
        var index = (x + y * width) * 4;

        canvasData.data[index + 0] = r;
        canvasData.data[index + 1] = g;
        canvasData.data[index + 2] = b;
        canvasData.data[index + 3] = a;
    }

    function updateCanvas() {
        ctx.putImageData(canvasData, 0, 0);
    }

    function writePixels() {
        var aspectRatio = width / height;
        var fov = 40;
        var max_x = Math.tan(degToRad(fov));
        var max_y = max_x / aspectRatio;
        console.log("max_x is " + max_x + ". max_y is " + max_y);

        if (useWorkers) {
            var workers = [];
            for (var i = 0; i < numWorkers; i++) {
                workers[i] = new Worker("worker.js");
                workers[i].postMessage({action: "setD", d: d, max_x: max_x, max_y : max_y, width: width, height: height});
                workers[i].onmessage = function(e) {
                    if (e.data.action === "getPixels") {
                        for (var i in e.data.pixels) {
                            var pixel = e.data.pixels[i];
                            writePixel(pixel.x, pixel.y, pixel.color[0], pixel.color[1], pixel.color[2], 255);
                        }

                        if (e.data.pixels[0].y % 20 == 0 || e.data.pixels[0].y > height - 1 - (numWorkers * lineSkip))
                            updateCanvas();
                    }
                };
            }

            for (var y = 0; y < height; y += lineSkip) {
                var rays = [];

                postMessageCalls++;
                workers[(y / lineSkip) % numWorkers].postMessage({y1: y, y2: y + lineSkip, action: "getPixels"});
            }
        }
        else {
            window.d = d;

            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    var ray = vNormalize(vAdd(d.camera.direction, [x / width * max_x - (max_x/2), -(y / height * max_y) + (max_y/2), 0]));
                    var color = getColorForRay(ray);
                    writePixel(x, y, color[0], color[1], color[2], 255);
                }
            }
        }

        updateCanvas();
    }
    preprocessPrimitives(d.primitives, d.transformations);
    writePixels();

    return d;
}

$(document).ready(function() {
    $.getJSON("scenes/model.json", function(d) {
        window.d = drawImage(d);
    });
});