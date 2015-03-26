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

        var worldHitPoint = m4Multv3(primitive.mTrans, hitPoint);

        // UV mapping for spheres
        // http://en.wikipedia.org/wiki/UV_mapping
        if (primitive.requiresMapping) {
            var mappingCoord = m4Multv3(primitive.mTransNoTranslate, hitPoint);
            var mappingPoint = [
                Math.atan2(mappingCoord[2], mappingCoord[0]) / (Math.PI),
                -Math.asin(mappingCoord[1]) / Math.PI * 2
            ];

            return {
                t: result / cameraRayRatio,
                normal: normal,
                hitPoint: worldHitPoint,
                mappingPoint: mappingPoint
            }
        }
        else {
            return {
                t: result / cameraRayRatio,
                normal: normal,
                hitPoint: worldHitPoint
            }
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
    hitPoint = vAdd(m4Multv3(primitive.mTransNoTranslate, hitPoint), position);

    // Project 3D coordinates onto plane
    if (primitive.requiresMapping) {
        var mappingPoint = [
            vDot(primitive.right, hitPoint),
            vDot(primitive.away, hitPoint)
        ];

        return {
            t: result,
            normal: primitive.normal,
            hitPoint: hitPoint,
            mappingPoint: mappingPoint
        }
    }
    else {
        return {
            t: result,
            normal: primitive.normal,
            hitPoint: hitPoint
        }
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
        var worldHitPoint = m4Multv3(primitive.mTrans, hitPoint);
        normal = vNormalize(m4Multv3(primitive.mTransRotateAndInvScale, normal));

        // Texture mapping
        if (primitive.requiresMapping) {
            var mappingCoord = m4Multv3(primitive.mTransScaleOnlyInv, hitPoint);
            if (hitPoint[0] > bounds[1][0] - e) {
                var right = [0, 1, 0];
                var away = [0, 0, 1];
            }
            else if (hitPoint[0] < bounds[0][0] + e) {
                var right = [0, -1, 0];
                var away = [0, 0, -1];
            }
            else if (hitPoint[1] > bounds[1][1] - e) {
                var right = [1, 0, 0];
                var away = [0, 0, 1];
            }
            else if (hitPoint[1] < bounds[0][1] + e) {
                var right = [-1, 0, 0];
                var away = [0, 0, -1];
            }
            else if (hitPoint[2] > bounds[1][2] - e) {
                var right = [1, 0, 0];
                var away = [0, 1, 0];
            }
            else if (hitPoint[2] < bounds[0][2] + e) {
                var right = [-1, 0, 0];
                var away = [0, -1, 0];
            }

            var mappingPoint = [
                vDot(right, mappingCoord),
                vDot(away, mappingCoord)
            ];

            return {
                t: result / cameraRayRatio,
                normal: normal,
                hitPoint: worldHitPoint,
                mappingPoint: mappingPoint
            }
        }

        return {
            t: result / cameraRayRatio,
            normal: normal,
            hitPoint: worldHitPoint
        }
    }
    else {
        return {
            t: result / cameraRayRatio,
            normal: normal,
            hitPoint: hitPoint
        }
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
    if (primitive.type === "triangle" || primitive.type === "boundingBox" || primitive.type === "plane") {
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