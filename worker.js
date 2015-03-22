if (typeof importScripts === "undefined")
    importScripts = function() {};

importScripts('util.js');

d = {};

var findPrimitive = function(id) {
    for (var i in d.primitives) {
        if (d.primitives[i].id == id) return d.primitives[i];
    }
};

function intersectSphere(primitive, cameraStart, cameraDir, cameraRayRatio, invTrans, invTransNoTranslate, invTransNoScale, resultOnly, position) {
    // http://en.wikipedia.org/wiki/Line%E2%80%93sphere_intersection
    var centerDiff = v3Sub(cameraStart, primitive.center);
    var b = vDot(cameraDir, centerDiff);

    var c4 = vDot(centerDiff, centerDiff) - (primitive.radius * primitive.radius);
    var disc = b * b - c4;

    if (disc <= e) {
        return false;
    }
    var sqrt_disc = Math.sqrt(disc);

    var result = -b - sqrt_disc;

    if (result < e) {
        result = -b + sqrt_disc;
    }

    if (result > e) {
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
    return false;
}

function intersectPlane(primitive, cameraStart, cameraDir, cameraRayRatio, resultOnly, position) {
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

function intersectTriangle(primitive, cameraStart, cameraDir, cameraRayRatio, resultOnly, position) {
    // http://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
    var v1 = primitive.v1;
    var v2 = primitive.v2;
    var v3 = primitive.v3;

    var e1 = primitive.e1;
    var e2 = primitive.e2;

    var p = vCross3(cameraDir, e2);
    var det = vDot(e1, p);
    if (det > -e && det < e) return false;
    var detInv = 1 / det;

    var t = v3Sub(cameraStart, v1);
    var u = vDot(t, p) * detInv;
    if (u < 0 || u > 1) return false;

    var q = vCross3(t, e1);
    var v = vDot(cameraDir, q) * detInv;
    if (v < 0 || u + v > 1) return false;

    var result = vDot(e2, q) * detInv;
    if (result > e) {
        if (resultOnly) return result / cameraRayRatio;
        var hitPoint = vMult(cameraDir, result);

        return {
            t: result / cameraRayRatio,
            normal: primitive.normal,
            hitPoint: vAdd(m4Multv3(primitive.mTransNoTranslate, hitPoint), position)
        };
    }
    return false;
}

function intersectBox(primitive, cameraStart, cameraDir, cameraRayRatio, resultOnly) {
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

    if ((tmin > tymax - e) || (tymin > tmax - e)) return false;
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

    if ((tmin > tzmax - e) || (tzmin > tmax - e))
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

    var normal = [0.5, 0.5, 0.5];
    if (hitPoint[0] > bounds[1][0] - e)
        normal = [1, 0, 0];
    else if (hitPoint[0] < bounds[0][0] + e)
        normal = [-1, 0, 0];
    else if (hitPoint[1] > bounds[1][1] - e)
        normal = [0, 1, 0];
    else if (hitPoint[1] < bounds[0][1] + e)
        normal = [0, -1, 0];
    else if (hitPoint[2] > bounds[1][2] - e)
        normal = [0, 0, 1];
    else if (hitPoint[2] < bounds[0][2] + e)
        normal = [0, 0, -1];
    else {
        console.log("This should never happen. e set too low.");
        return false;
    }

    if (primitive.type === "box") {
        hitPoint = m4Multv3(primitive.mTrans, hitPoint);
        normal = vNormalize(m4Multv3(primitive.mTransRotateAndInvScale, normal));
    }
    return {
        t: result / cameraRayRatio,
        normal: normal,
        hitPoint: hitPoint
    }
}

// triangles, planes and bounding boxes are treated in world space and
// don't have any further transformations performed in the intersect function.
// spheres are treated in model space, and the ray is transformed from world
// space to model space insde the method.
// 
// This method always takes camera coordinates in world space, and returns
// all values in world space as well.
function intersect(primitive, position, ray, resultOnly) {
    if (primitive.type === "triangle" || primitive.type === "boundingBox") {
        var cameraStart = position;
        var cameraDir = ray;
        var cameraRayRatio = 1;
    }
    else {
        var invTrans = mTransInv(primitive);
        var invTransNoTranslate = mTransNoTranslateInv(primitive);
        var invTransNoScale = mTransNoScaleInv(primitive);
        
        var cameraStart = m4Multv3(invTrans, position);
        var cameraDir = m4Multv3(invTransNoTranslate, ray);
        var cameraRayRatio = vLen(cameraDir);
        cameraDir = vNormalize(cameraDir);
    }

    // SPHERE ------------------------------------------------------------------------
    if (primitive.type === "sphere") {
        return intersectSphere(primitive, cameraStart, cameraDir, cameraRayRatio, invTrans, invTransNoTranslate, invTransNoScale, resultOnly, position)
    }
    // PLANE ------------------------------------------------------------------------
    else if (primitive.type === "plane") {
        return intersectPlane(primitive, cameraStart, cameraDir, cameraRayRatio, resultOnly, position);
    }
    // TRIANGLE ------------------------------------------------------------------------
    else if (primitive.type === "triangle") {
        return intersectTriangle(primitive, position, ray, 1, resultOnly, position);
    }
    // BOX ------------------------------------------------------------------------
    else if (primitive.type === "box" || primitive.type === "boundingBox") {
        return intersectBox(primitive, cameraStart, cameraDir, cameraRayRatio, resultOnly);
    }
    // MODEL ------------------------------------------------------------------------
    else if (primitive.type === "model") {
        // test bounding box
        var tmpPrimitive = {
            type: "boundingBox",
            bounds: primitive.bounds,
            id: primitive.id+"_boundingBox"
        };

        var boundingBoxResult = intersectBox(tmpPrimitive, position, ray, 1, true);
        if (boundingBoxResult === false) return false;

        var bestResult = false;

        if (primitive.hasPartitions && usePartitions) {
            for (var i = 0; i < primitive.partitions.length; i++) {
                if (primitive.partitions[i] === false) continue;
                var partitionResult = intersect(primitive.partitions[i], position, ray, resultOnly);
                if (bestResult === false || partitionResult.t < bestResult.t)
                    bestResult = partitionResult;
            }
        }
        else {
            for (var i = 0; i < primitive.triangles.length; i++) {
                var triangleResult = intersect(primitive.triangles[i], position, ray, resultOnly);
                if (bestResult === false || triangleResult.t < bestResult.t)
                    bestResult = triangleResult;
            }
        }

        return bestResult;
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

function getColorForRay(cameraPosition, rayN, reflections) {
    var zFar = 10000000000000;
    var color = [0, 0, 0];

    for (var i = 0; i < d.primitives.length; i++) {
        var primitive = d.primitives[i];
        var result = intersect(primitive, cameraPosition, rayN);

        if (result.t !== false && result.t > e) {
            var hitPointToCamera = v3Sub(cameraPosition, result.hitPoint);  // V
            var hitPointToCameraDist = vLen(hitPointToCamera);
            if (hitPointToCameraDist > zFar)
                continue;

            var hitPointToCameraN = vNormalize(hitPointToCamera);

            zFar = hitPointToCameraDist;
            var ambientColor = vCompMultv(primitive.ambientColor, d.ambientIntensity);

            color = ambientColor;

            var hasRefraction = false;
            var hasReflection = false;
            if (primitive.refraction && !vEq(primitive.refraction, [0, 0, 0]) && reflections <= maxReflections && ENABLE_REFRACTION) {
                hasRefraction = true;
                hasReflection = false;

                var hitpointToCameraDot = vDot(result.normal, hitPointToCameraN);
                var incidentAngle = Math.acos(hitpointToCameraDot);
                //console.log(hitpointToCameraDot, radToDeg(incidentAngle));

                var cameraToHitPointN = vNeg(hitPointToCameraN);
                //var refractColor = getColorForRay(result.hitPoint, cameraToHitPointN, reflections + 1);
                //color = refractColor;
                //continue;

                // http://steve.hollasch.net/cgindex/render/refraction.txt
                if (hitpointToCameraDot >= 0) {
                    var eta = 1 / primitive.refractionIndex;
                    var c1 = vDot(hitPointToCameraN, result.normal);
                }
                else {
                    var eta = primitive.refractionIndex;
                    var c1 = -vDot(hitPointToCameraN, result.normal);
                }
                
                var cs2 = 1 - eta * eta * (1 - c1 * c1);
                if (cs2 >= 0) {
                    var refractDirection = vAdd(vMult(cameraToHitPointN, eta), vMult(result.normal, eta * c1 - Math.sqrt(cs2)));
                    if (eta * c1 - Math.sqrt(cs2) != 0) {
                        //console.log("Wtf ", eta, cs2, c1*c1, Math.sqrt(cs2), c1)
                    }

                    //console.log(eta, c1, cs2, eta * c1 - Math.sqrt(cs2));
                    //console.log(result.hitPoint, cameraToHitPointN, hitpointToCameraDot, refractDirection);

                    var refractColor = getColorForRay(result.hitPoint, refractDirection, reflections + 1);
                    color = refractColor;
                    continue;
                }
                else {
                    hasReflection = true;
                    primitive.reflection = primitive.refraction;
                }

                //color = [(hitpointToCameraDot + 1) * 128, (hitpointToCameraDot + 1) * 128, (hitpointToCameraDot + 1) * 128];
            }

            if (primitive.reflection && !vEq(primitive.reflection, [0, 0, 0]) && reflections <= maxReflections && ENABLE_REFLECTION) {
                var hitPointToCameraR = vNeg(v3Sub(hitPointToCameraN, vMult(result.normal, 2 * (vDot(hitPointToCameraN, result.normal)))));
                var reflectColor = vCompMultv(getColorForRay(result.hitPoint, hitPointToCameraR, reflections + 1), primitive.reflection);
                var hasReflection = true;
            }

            if (!hasReflection || !vEq(primitive.reflection, [1, 1, 1])) {
                for (var j = 0; j < d.lights.length; j++) {
                    var light = d.lights[j];

                    // compute color based on Phong reflection model
                    // http://en.wikipedia.org/wiki/Phong_reflection_model
                    var hitPointToLight = v3Sub(light.center, result.hitPoint);  // L
                    var hitPointToLightN = vNormalize(hitPointToLight);
                    var hitPointToLightDist = vLen(hitPointToLight);

                    if (checkLightRayForShadow(result, light, hitPointToLightN, hitPointToLightDist)) {
                        if (hasReflection) {
                            color = vAdd(color, reflectColor);
                        }
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
                    var surfaceColor = vAdd(diffuseColor, specularColor);

                    if (!hasReflection)
                        color = vAdd(color, surfaceColor);
                    else {
                        color = vAdd3(color, reflectColor, vCompMultv(surfaceColor, primitive.reflectionInv));
                    }
                    //color = [(result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128];
                    //if (Math.random() < 0.1 && primitive.id == "origin") console.log(lightToHitPointN);
                    //if (primitive.id == "model1") 
                    //    color = [(result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128];
                }
            }
            else {
                // pure reflection
                color = reflectColor;
            }
        }
    }

    return color;
}

onmessage = function(e) {
    if (e.data.action === "getPixel") {
        var color = getColorForRay(d.camera.position, e.data.ray, 0);
        postMessage({
            color: color,
            x: e.data.x,
            y: e.data.y
        });
    }
    if (e.data.action === "getPixels") {
        var data = [];
        var rays = [];
        for (var y = e.data.y1; y < e.data.y2; y++) {
            for (var x = 0; x < width; x++) {
                rays.push({x: x, y: y});
            }
        }

        for (var i in rays) {
            var rayData = rays[i];
            var ray = vNormalize(vAdd(d.camera.direction, [rayData.x / width * max_x - (max_x/2), -(rayData.y / height * max_y) + (max_y/2), 0]));
            data.push({
                color: getColorForRay(d.camera.position, ray, 0),
                x: rayData.x,
                y: rayData.y
            });
        }
        postMessage({
            action: "getPixels",
            pixels: data
        });
    }
    else if (e.data.action === "setD") {
        d = JSON.parse(e.data.d);
        max_x = e.data.max_x;
        max_y = e.data.max_y;
        width = e.data.width;
        height = e.data.height;
    }
}