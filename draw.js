e = 0.00000000001

function drawImage() {
    var c = document.getElementById("render");
    var ctx = c.getContext("2d");

    var width = c.width;
    var height = c.height;
    var canvasData = ctx.getImageData(0, 0, width, height);

    var primitives = [
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
        }
    ];

    var lights = [
        {
            center: [0, 10, 0],
            diffuseIntensity: [0.5, 0.5, 0.5],
            specularIntensity: [0.5, 0.5, 0.5],
            falloff: [1, 0, 0]
        }
    ];

    var transformations = [
        { target: "plane1", type: "translate", amount: [0, -2, 0]},
        { target: "planeback", type: "rotate", amount: 90, axis: "x"},
        { target: "planeback", type: "translate", amount: [0, 0, -3]},
        { target: "sphere1", type: "translate", amount: [2.5, 2.5, 0]},
        { target: "origin", type: "scale", amount: [0.4, 0.4, 0.4]},
    ];

    var camera = {
        position: [0, 0, 10],
        direction: vNormalize([0, 0, -1]),
        up: vNormalize([0, 1, 0])
    };

    var ambientIntensity = [0.1, 0.1, 0.1];

    var findPrimitive = function(id) {
        for (var i in primitives) {
            if (primitives[i].id == id) return primitives[i];
        }
    };

    var preprocessPrimitives = function() {
        for (var i in primitives) {
            var primitive = primitives[i];
            if (!primitive.mTrans) {
                primitive.mTrans = m4();
                primitive.mTransNoScale = m4();
                primitive.mTransNoTranslate = m4();
            }

            if (primitive.type === "sphere") {
                primitive.radius = 1;
                primitive.center = [0, 0, 0];
            }
            else if (primitive.type === "plane") {
                primitive.normal = [0, 1, 0];
                primitive.point = [0, 0, 0];
            } 
        }

        for (var i in transformations) {
            var t = transformations[i];
            var primitive = findPrimitive(t.target);
            if (!primitive) continue;

            if (t.type === "translate") {
                primitive.mTrans = mTranslate(t.amount[0], t.amount[1], t.amount[2], primitive.mTrans);
                primitive.mTransNoScale = mTranslate(t.amount[0], t.amount[1], t.amount[2], primitive.mTransNoScale);
            }
            else if (t.type === "scale") {
                primitive.mTrans = mScale(t.amount[0], t.amount[1], t.amount[2], primitive.mTrans);
                primitive.mTransNoTranslate = mScale(t.amount[0], t.amount[1], t.amount[2], primitive.mTransNoTranslate);
            }
            else if (t.type === "rotate") {
                primitive.mTrans = mRotate(t.axis, t.amount, primitive.mTrans);
                primitive.mTransNoTranslate = mRotate(t.axis, t.amount, primitive.mTransNoTranslate);
                primitive.mTransNoScale = mRotate(t.axis, t.amount, primitive.mTransNoScale);
            }
        }

        for (var i in primitives) {
            var primitive = primitives[i];
            if (primitive.type === "plane") {
                primitive.normal = m4Multv3(primitive.mTransNoTranslate, [0, 1, 0]);
                primitive.point = m4Multv3(primitive.mTransNoScale, [0, 0, 0]);
                primitive.mTrans = m4();
                primitive.mTransNoTranslate = m4();
                primitive.mTransNoScale = m4();
            } 
        }
    };

    var mTransInv = function(primitive) {
        if (!primitive.mTransInv) {
            if (!primitive.mTrans) {
                primitive.mTrans = m4();
            }
            primitive.mTransInv = m4Inverse(primitive.mTrans);
        }
        return primitive.mTransInv;
    };

    var mTransNoTranslateInv = function(primitive) {
        if (!primitive.mTransNoTranslateInv) {
            if (!primitive.mTransNoTranslate) {
                primitive.mTransNoTranslate = m4();
            }
            primitive.mTransNoTranslateInv = m4Inverse(primitive.mTransNoTranslate);
        }
        return primitive.mTransNoTranslateInv;
    };

    var mTransNoScaleInv = function(primitive) {
        if (!primitive.mTransNoScaleInv) {
            if (!primitive.mTransNoScale) {
                primitive.mTransNoScale = m4();
            }
            primitive.mTransNoScaleInv = m4Inverse(primitive.mTransNoScale);
        }
        return primitive.mTransNoScaleInv;
    };

    function intersect(primitive, position, ray, resultOnly) {
        var invTrans = mTransInv(primitive);
        var invTransNoTranslate = mTransNoTranslateInv(primitive);
        var invTransNoScale = mTransNoScaleInv(primitive);

        var cameraStart = m4Multv3(invTrans, position);
        var cameraDir = vNormalize(m4Multv3(invTransNoTranslate, ray));

        if (primitive.type === "sphere") {
            // http://en.wikipedia.org/wiki/Line%E2%80%93sphere_intersection
            if (window.doLog) {
                cameraStart[2] = -cameraStart[2];
            }
            var centerDiff = v3Sub(cameraStart, primitive.center);
            var b = vDot(cameraDir, centerDiff);

            var c4 = vDot(centerDiff, centerDiff) - (primitive.radius * primitive.radius);
            var disc = b * b - c4;
            if (window.doLog && position[1] < -1.8 && position[1] > -2 && position[0] > 1) {
                console.log(cameraStart, cameraDir);
            }

            if (disc <= 0) {
                return false;
            }
            var sqrt_disc = Math.sqrt(disc);

            var result = -b - sqrt_disc;

            if (result < 0) {
                result = -b + sqrt_disc;
            }

            
            if (result > 0) {
                if (resultOnly) return result;
                var hitPoint = vMult(cameraDir, result);
                var normal = vNormalize(vAdd(centerDiff, hitPoint));

                return {
                    t: result,
                    normal: normal,
                    hitPoint: vAdd(m4Multv3(primitive.mTransNoTranslate, hitPoint), position)
                }
            }
        }
        else if (primitive.type === "plane") {
            // http://en.wikipedia.org/wiki/Line%E2%80%93plane_intersection
            var denom = vDot(cameraDir, primitive.normal);
            if (denom < e && denom > -e) return false;

            var num = vDot(vSub(primitive.point, cameraStart), primitive.normal);

            var result = num / denom;
            if (result < 0) return false;
            if (resultOnly) return result;

            var hitPoint = vMult(cameraDir, result);
            
            return {
                t: result,
                normal: primitive.normal,
                hitPoint: vAdd(m4Multv3(primitive.mTransNoTranslate, hitPoint), position)
            }
        }

        return false;
    }

    function writePixel(x, y, r, g, b, a) {
        var index = (x + y * width) * 4;

        canvasData.data[index + 0] = r;
        canvasData.data[index + 1] = g;
        canvasData.data[index + 2] = b;
        canvasData.data[index + 3] = a;
    }

    function writePixels() {
        var aspectRatio = width / height;
        var fov = 40;
        var max_x = Math.tan(degToRad(fov));
        var max_y = max_x / aspectRatio;
        console.log("max_x is " + max_x + ". max_y is " + max_y);

        for (var x = 0; x < width; x++) {
            for (var y = 0; y < width; y++) {
                var ray = vNormalize(vAdd(camera.direction, [x / width * max_x - (max_x/2), -(y / height * max_y) + (max_y/2), 0]));

                var color = getColorForRay(ray);
                writePixel(x, y, color[0], color[1], color[2], 255);
            }
        }

        ctx.putImageData(canvasData, 0, 0);
    }

    function checkLightRayForShadow(result, light, hitPointToLightN, hitPointToLightDist, hitPrimitive) {
        for (var i = 0; i < primitives.length; i++) {
            var primitive = primitives[i];
            window.doLog = false;
            if (hitPrimitive.id === "planeback" && primitive.id === "sphere1") {
                window.doLog = true;
            }
            var lightResult = intersect(primitive, result.hitPoint, hitPointToLightN, true);

            if (lightResult !== false && lightResult > e && lightResult < hitPointToLightDist + e) {
                return true;
            }
        }
        return false;
    }

    function getColorForRay(rayN) {
        var zFar = 10000000000000;
        var color = [0, 0, 0];

        for (var i = 0; i < primitives.length; i++) {
            var primitive = primitives[i];
            var result = intersect(primitive, camera.position, rayN);

            if (result.t !== false && result.t > 0) {
                var hitPointToCamera = v3Sub(camera.position, result.hitPoint);  // V
                var hitPointToCameraDist = vLen(hitPointToCamera);
                if (hitPointToCameraDist > zFar)
                    continue;

                var hitPointToCameraN = vNormalize(hitPointToCamera);

                zFar = hitPointToCameraDist;
                color = [0, 0, 0];

                for (var j = 0; j < lights.length; j++) {
                    var light = lights[j];

                    var ambientColor = vCompMultv(primitive.ambientColor, ambientIntensity);

                    // compute color based on Phong reflection model
                    // http://en.wikipedia.org/wiki/Phong_reflection_model
                    var hitPointToLight = m4Multv3(mTransNoTranslateInv(primitive), v3Sub(light.center, result.hitPoint));  // L
                    var hitPointToLightN = vNormalize(hitPointToLight);
                    var hitPointToLightDist = vLen(hitPointToLight);

                    if (checkLightRayForShadow(result, light, hitPointToLightN, hitPointToLightDist, primitive)) {
                        color = vAdd(color, ambientColor);
                        continue;
                    }

                    var lightToHitPoint = vNeg(hitPointToLight);
                    var lightToHitPointN = vNeg(hitPointToLightN);

                    var hitPointToLightR = v3Sub(lightToHitPointN, vMult(result.normal, 2 * (vDot(lightToHitPointN, result.normal))));    // R

                    var lightFalloff = 1 / (light.falloff[0] + light.falloff[1] * hitPointToLightDist + light.falloff[2] * hitPointToLightDist * hitPointToLightDist);
                    var diffuseColor = vMult(primitive.diffuseColor, Math.max(0, vDot(result.normal, hitPointToLightN) * lightFalloff));
                    diffuseColor = vCompMultv(diffuseColor, light.diffuseIntensity);

                    var specularFactor = Math.max(0.0, Math.pow(vDot(hitPointToLightR, hitPointToCameraN), 25));
                    var specularColor = vCompMultv(vMult(primitive.specularColor, specularFactor), light.specularIntensity);

                    color = vAdd(color, vAdd3(diffuseColor, specularColor, ambientColor));
                }
            }
        }

        return color;
    }

    preprocessPrimitives();
    writePixels();

    return {
        primitives: primitives,

    }
}

$(document).ready(function() {
    window.d = drawImage();
});