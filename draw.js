e = 0.00001

function drawImage() {
    var c = document.getElementById("render");
    var ctx = c.getContext("2d");

    var width = c.width;
    var height = c.height;
    var canvasData = ctx.getImageData(0, 0, width, height);
    var d = {};

    d.primitives = [
        {
            type: "sphere",
            id: "sphere1",
            diffuseColor: [255, 233, 211],
            specularColor: [255, 255, 255],
            ambientColor: [255, 255, 255],
        },
        {
            type: "sphere",
            id: "origin",
            diffuseColor: [255, 0, 0],
            specularColor: [255, 0, 0],
            ambientColor: [255, 0, 0],
        },
        {
            type: "plane",
            id: "plane1",
            diffuseColor: [255, 255, 255],
            specularColor: [0, 0, 0],
            ambientColor: [255, 255, 255]
        },
        {
            type: "plane",
            id: "planeback",
            diffuseColor: [0, 0, 255],
            specularColor: [0, 0, 0],
            ambientColor: [0, 0, 0]
        },
        {
            type: "box",
            id: "box1",
            diffuseColor: [0, 255, 0],
            specularColor: [0, 255, 0],
            ambientColor: [0, 255, 0]
        }
    ];

    d.lights = [
        {
            center: [0, 2.5, 0],
            diffuseIntensity: [0.5, 0.5, 0.5],
            specularIntensity: [0.5, 0.5, 0.5],
            falloff: [1, 0, 0]
        }
    ];

    d.transformations = [
        { target: "plane1", type: "translate", amount: [0, -2, 0]},
        { target: "planeback", type: "rotate", amount: 90, axis: "x"},
        { target: "planeback", type: "translate", amount: [0, 0, -3]},
        { target: "sphere1", type: "rotate", axis: "x", amount: 30},
        { target: "sphere1", type: "translate", amount: [2.5, 2.5, 0]},
        { target: "origin", type: "scale", amount: [0.4, 0.4, 0.4]},
        { target: "origin", type: "rotate", axis: "x", amount: 60},
        { target: "box1", type: "rotate", axis: "y", amount: 75},
        { target: "box1", type: "rotate", axis: "x", amount: 60},
        { target: "box1", type: "rotate", axis: "z", amount: 45},
        { target: "box1", type: "translate", amount: [-2, 2, -1]},
    ];

    d.camera = {
        position: [0, 0, 10],
        direction: vNormalize([0, 0, -1]),
        up: vNormalize([0, 1, 0])
    };

    d.ambientIntensity = [0.1, 0.1, 0.1];

    var findPrimitive = function(id) {
        for (var i in d.primitives) {
            if (d.primitives[i].id == id) return d.primitives[i];
        }
    };

    var preprocessPrimitives = function() {
        for (var i in d.primitives) {
            var primitive = d.primitives[i];
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
        }

        for (var i in d.transformations) {
            var t = d.transformations[i];
            var primitive = findPrimitive(t.target);
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

        for (var i in d.primitives) {
            var primitive = d.primitives[i];
            if (primitive.type === "plane") {
                primitive.normal = m4Multv3(primitive.mTransNoTranslate, [0, 1, 0]);
                primitive.point = m4Multv3(primitive.mTransNoScale, [0, 0, 0]);
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

        useWorkers = false;
        if (useWorkers) {
            var workers = [];
            var numWorkers = 3;
            for (var i = 0; i < numWorkers; i++) {
                workers[i] = new Worker("worker.js");
                workers[i].postMessage({action: "setD", d: d});
                workers[i].onmessage = function(e) {
                    writePixel(e.data.x, e.data.y, e.data.color[0], e.data.color[1], e.data.color[2], 255);

                    if ((e.data.x === width - i && e.data.y % 50 == 0) || (e.data.y === (height - 1) && e.data.x > width - numWorkers - 1))
                        updateCanvas();
                };
            }
        }
        else {
            window.d = d;
        }

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var ray = vNormalize(vAdd(d.camera.direction, [x / width * max_x - (max_x/2), -(y / height * max_y) + (max_y/2), 0]));
                if (useWorkers) {
                    workers[(y * width + x) % numWorkers].postMessage({action: "getPixel", ray: ray, x: x, y: y});
                }
                else {
                    var color = getColorForRay(ray);
                    writePixel(x, y, color[0], color[1], color[2], 255);
                }
            }
        }

        updateCanvas();
    }
    preprocessPrimitives();
    writePixels();

    return d;
}

$(document).ready(function() {
    window.d = drawImage();
});