if (typeof importScripts === "undefined")
    importScripts = function() {};

importScripts('util.js');

e = 0.00000000001
d = {};

var findPrimitive = function(id) {
    for (var i in d.primitives) {
        if (d.primitives[i].id == id) return d.primitives[i];
    }
};

function intersect(primitive, position, ray, resultOnly) {
    var invTrans = mTransInv(primitive);
    var invTransNoTranslate = mTransNoTranslateInv(primitive);
    var invTransNoScale = mTransNoScaleInv(primitive);

    var cameraStart = m4Multv3(invTrans, position);
    var cameraDir = m4Multv3(invTransNoTranslate, ray);
    var cameraRayRatio = vLen(cameraDir);
    cameraDir = vNormalize(cameraDir);

    if (primitive.type === "sphere") {
        // http://en.wikipedia.org/wiki/Line%E2%80%93sphere_intersection
        var centerDiff = v3Sub(cameraStart, primitive.center);
        var b = vDot(cameraDir, centerDiff);

        var c4 = vDot(centerDiff, centerDiff) - (primitive.radius * primitive.radius);
        var disc = b * b - c4;

        if (disc <= 0) {
            return false;
        }
        var sqrt_disc = Math.sqrt(disc);

        var result = -b - sqrt_disc;

        if (result < 0) {
            result = -b + sqrt_disc;
        }
        
        if (result > 0) {
            if (resultOnly) return result / cameraRayRatio;

            var hitPoint = vAdd(centerDiff, vMult(cameraDir, result));
            var normal = vNormalize(m4Multv3(primitive.mTransRotateAndInvScale, hitPoint));

            hitPoint = m4Multv3(primitive.mTrans, hitPoint);

            return {
                t: result / cameraRayRatio,
                normal: normal,
                hitPoint: hitPoint
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
    else if (primitive.type === "box") {
        // http://www.scratchapixel.com/old/lessons/3d-basic-lessons/lesson-7-intersecting-simple-shapes/ray-box-intersection/
        var invDir = vInv(cameraDir);
        var tmin, tmax, tymin, tymax, tzmin, tzmax;
        var bounds = primitive.bounds;
        if (cameraDir[0] < 0) {
            tmin = (bounds[1][0] - cameraStart[0]) * invDir[0];
            tmax = (bounds[0][0] - cameraStart[0]) * invDir[0];
        }
        else {
            tmin = (bounds[0][0] - cameraStart[0]) * invDir[0];
            tmax = (bounds[1][0] - cameraStart[0]) * invDir[0];
        }

        if (cameraDir[1] < 0) {
            tymin = (bounds[1][1] - cameraStart[1]) * invDir[1];
            tymax = (bounds[0][1] - cameraStart[1]) * invDir[1];
        }
        else {
            tymin = (bounds[0][1] - cameraStart[1]) * invDir[1];
            tymax = (bounds[1][1] - cameraStart[1]) * invDir[1];
        }

        if ((tmin > tymax) || (tymin > tmax)) return false;
        if (tymin > tmin) tmin = tymin;
        if (tymax < tmax) tmax = tymax;

        if (cameraDir[2] < 0) {
            tzmin = (bounds[1][2] - cameraStart[2]) * invDir[2];
            tzmax = (bounds[0][2] - cameraStart[2]) * invDir[2];
        }
        else {
            tzmin = (bounds[0][2] - cameraStart[2]) * invDir[2];
            tzmax = (bounds[1][2] - cameraStart[2]) * invDir[2];
        }

        if ((tmin > tzmax) || (tzmin > tmax))
            return false;
        if (tzmin > tmin)
            tmin = tzmin;
        if (tzmax < tmax)
            tmax = tzmax;

        var result = tmax;
        if (tmin > 0) {
            result = tmin;
        }
        if (resultOnly) return result;

        var hitPoint = vAdd(cameraStart, vMult(cameraDir, result));
        //console.log(hitPoint);

        var normal = [0.5, 0.5, 0.5];
        if (hitPoint[0] > 0.5 - e)
            normal = [1, 0, 0];
        else if (hitPoint[0] < -0.5 + e)
            normal = [-1, 0, 0];
        else if (hitPoint[1] > 0.5 - e)
            normal = [0, 1, 0];
        else if (hitPoint[1] < -0.5 + e)
            normal = [0, -1, 0];
        else if (hitPoint[2] > 0.5 - e)
            normal = [0, 0, 1];
        else if (hitPoint[2] < -0.5 + e)
            normal = [0, 0, -1];
        else
            console.log("This should never happen. e set too low.");

        hitPoint = m4Multv3(primitive.mTrans, hitPoint);
        //console.log(normal);

        normal = vNormalize(m4Multv3(primitive.mTransRotateAndInvScale, normal));
        return {
            t: result,
            normal: normal,
            hitPoint: hitPoint
        }
    }

    return false;
}

function checkLightRayForShadow(result, light, hitPointToLightN, hitPointToLightDist) {
    for (var i = 0; i < d.primitives.length; i++) {
        var primitive = d.primitives[i];
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

    for (var i = 0; i < d.primitives.length; i++) {
        var primitive = d.primitives[i];
        var result = intersect(primitive, d.camera.position, rayN);

        if (result.t !== false && result.t > 0) {
            var hitPointToCamera = v3Sub(d.camera.position, result.hitPoint);  // V
            var hitPointToCameraDist = vLen(hitPointToCamera);
            if (hitPointToCameraDist > zFar)
                continue;

            var hitPointToCameraN = vNormalize(hitPointToCamera);

            zFar = hitPointToCameraDist;
            color = [0, 0, 0];

            for (var j = 0; j < d.lights.length; j++) {
                var light = d.lights[j];

                var ambientColor = vCompMultv(primitive.ambientColor, d.ambientIntensity);

                // compute color based on Phong reflection model
                // http://en.wikipedia.org/wiki/Phong_reflection_model
                var hitPointToLight = v3Sub(light.center, result.hitPoint);  // L
                var hitPointToLightN = vNormalize(hitPointToLight);
                var hitPointToLightDist = vLen(hitPointToLight);

                if (checkLightRayForShadow(result, light, hitPointToLightN, hitPointToLightDist)) {
                    color = vAdd(color, ambientColor);
                    continue;
                }

                var lightToHitPoint = vNeg(hitPointToLight);
                var lightToHitPointN = vNeg(hitPointToLightN);

                var hitPointToLightR = v3Sub(lightToHitPointN, vMult(result.normal, 2 * (vDot(lightToHitPointN, result.normal))));    // R

                var lightFalloff = 1 / (light.falloff[0] + light.falloff[1] * hitPointToLightDist + light.falloff[2] * hitPointToLightDist * hitPointToLightDist);
                var diffuseColor = vMult(primitive.diffuseColor, Math.max(0, vDot(result.normal, hitPointToLightN) * lightFalloff));
                diffuseColor = vCompMultv(diffuseColor, light.diffuseIntensity);
                //diffuseColor = [0, 0, 0];

                var specularFactor = Math.max(0.0, Math.pow(vDot(hitPointToLightR, hitPointToCameraN), 25));
                var specularColor = vCompMultv(vMult(primitive.specularColor, specularFactor), light.specularIntensity);
                //specularColor = [0, 0, 0];

                color = vAdd(color, vAdd3(diffuseColor, specularColor, ambientColor));
                //color = [(result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128];
                //if (Math.random() < 0.1 && primitive.id == "origin") console.log(lightToHitPointN);
                //if (primitive.id == "box1") 
                //    color = [(result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128];
            }
        }
    }

    return color;
}

onmessage = function(e) {
    if (e.data.action === "getPixel") {
        var color = getColorForRay(e.data.ray);
        postMessage({
            color: color,
            x: e.data.x,
            y: e.data.y
        });
    }
    else if (e.data.action === "setD")
        d = e.data.d;
}