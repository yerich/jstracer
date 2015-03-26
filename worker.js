if (typeof importScripts === "undefined")
    importScripts = function() {};

importScripts('util.js', "geometry.js");

d = {};

var findPrimitive = function(id) {
    for (var i in d.primitives) {
        if (d.primitives[i].id == id) return d.primitives[i];
    }
};

// Use linear interpolation on perlin noise
var getPerlin = function(mappingPoint, primitive, mode) {
    mappingPoint[2] = mappingPoint[2] || 0;

    var coords = [[], []];
    var diff = [];
    for (var i = 0; i < 3; i++) {
        coords[0][i] = ((Math.floor(mappingPoint[i] * primitive.perlinTextureDimensions[i]) % flags['PERLIN_SIZE']) + flags['PERLIN_SIZE']) % flags['PERLIN_SIZE'];
        diff[i] = (((mappingPoint[i] * primitive.perlinTextureDimensions[i]) % flags['PERLIN_SIZE']) + flags['PERLIN_SIZE']) % flags['PERLIN_SIZE'] - (coords[0][i]);
        coords[1][i] = (coords[0][i] + 1) % flags['PERLIN_SIZE'];
    }

    if (mode === "blackAndWhite") {
        var sum = 0;
        for (var x = 0; x < 2; x++) {
            for (var y = 0; y < 2; y++) {
                for (var z = 0; z < 2; z++) {
                    sum += d.perlin[coords[x][0]][coords[y][1]][coords[z][2]][0] * (x === 1 ? diff[0] : 1 - diff[0]) * (y === 1 ? diff[1] : 1 - diff[1]) * (z === 1 ? diff[2] : 1 - diff[2]);
                }
            }
        }

        return [sum, sum, sum];
    }
    else {
        var sum = [0, 0, 0];
        for (var i = 0; i < 3; i++) {
            for (var x = 0; x < 2; x++) {
                for (var y = 0; y < 2; y++) {
                    for (var z = 0; z < 2; z++) {
                        sum[i] += d.perlin[coords[x][0]][coords[y][1]][coords[z][2]][i] * (x === 1 ? diff[0] : 1 - diff[0]) * (y === 1 ? diff[1] : 1 - diff[1]) * (z === 1 ? diff[2] : 1 - diff[2]);
                    }
                }
            }
        }

        return sum;
    }
}

// Get a pixel's texture color (not interpolated)
var getColorForTexture = function(textureData, mappingPoint, primitive) {
    var x = ((Math.floor(mappingPoint[0] * primitive.textureWidthFactor) % textureData.width) + textureData.width) % textureData.width;
    var y = ((Math.floor(mappingPoint[1] * primitive.textureHeightFactor) % textureData.height) + textureData.height) % textureData.height;

    var offset = (y * textureData.width + x) * 4;
    return [
        textureData.data[offset + 0],
        textureData.data[offset + 1],
        textureData.data[offset + 2],
    ];
}

// Get a pixel's bump map value
var getValueFromBumpMap = function(bumpMap, mappingPoint, primitive) {
    var x = ((Math.floor(mappingPoint[0] * primitive.bumpMapWidthFactor) % bumpMap.width) + bumpMap.width) % bumpMap.width;
    var y = ((Math.floor(mappingPoint[1] * primitive.bumpMapHeightFactor) % bumpMap.height) + bumpMap.height) % bumpMap.height;
    return bumpMap.data[y][x];
}

// Casts a ray towards a light source from a hitpoint, and looks for anything that blocks it.
// Returns true if light ray is blocked, false otherwise.
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

// Casts a ray from a camera position in a certain normalized direction, and gets the ultimate
// color of the ray, accounting for reflections and refractions.
function getColorForRay(cameraPosition, rayN, reflections, shadowSamples) {
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

            var hasRefraction = false;
            var hasReflection = false;
            var hasTexture = false;

            // Check for texturing
            if (primitive.texture && result.mappingPoint) {
                hasTexture = true;
                var textureColor = vMult(getColorForTexture(textureData[primitive.texture], result.mappingPoint, primitive), 1/255);
                ambientColor = vCompMultv(ambientColor, textureColor);
            }
            else if (primitive.perlinTexture && result.mappingPoint) {
                hasTexture = true;
                var textureColor = getPerlin(result.mappingPoint, primitive, primitive.perlinTextureMode);
                ambientColor = vCompMultv(ambientColor, textureColor);
            }
            color = [0, 0, 0];

            // Perturb the normal if a bump map is specified
            if (primitive.bumpMap && flags["BUMP_MAPPING"]) {
                var uv = getUVForNormal(result.normal);
                var normalDiff = getValueFromBumpMap(normalMapData[primitive.bumpMap], result.mappingPoint, primitive);
                result.normal = vNormalize(vAdd3(result.normal, vMult(uv.u, normalDiff[0] * primitive.bumpFactor), vMult(uv.v, normalDiff[1] * primitive.bumpFactor)));

                //color = [(normalDiff[0] + 1) * 128, (normalDiff[0] + 1) * 128, (normalDiff[0] + 1) * 128];
                //break;
            }

            // Account for refraction
            if (primitive.refraction && !vEq(primitive.refraction, [0, 0, 0]) && reflections <= maxReflections && ENABLE_REFRACTION) {
                hasRefraction = true;
                hasReflection = false;

                var hitpointToCameraDot = vDot(result.normal, hitPointToCameraN);
                var incidentAngle = Math.acos(hitpointToCameraDot);

                var cameraToHitPointN = vNeg(hitPointToCameraN);

                // Snell's law for refraction
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

                    var refractColor = getColorForRay(result.hitPoint, refractDirection, reflections + 1);
                    color = refractColor;
                    continue;
                }
                else {
                    hasReflection = true;
                    primitive.reflection = primitive.refraction;
                }
            }

            // Reflection
            if (primitive.reflection && !vEq(primitive.reflection, [0, 0, 0]) && reflections <= maxReflections && ENABLE_REFLECTION) {
                // Compute a new ray that starts at the hit point and goes in the direction of the original ray, reflected about the normal
                var hitPointToCameraR = vNeg(v3Sub(hitPointToCameraN, vMult(result.normal, 2 * (vDot(hitPointToCameraN, result.normal)))));
                var reflectColor = vCompMultv(getColorForRay(result.hitPoint, hitPointToCameraR, reflections + 1), primitive.reflection);
                var hasReflection = true;
                color = vAdd(vCompMultv(ambientColor, primitive.reflectionInv), vCompMultv(reflectColor, primitive.reflection));
            }
            else {
                color = ambientColor;
            }

            if (!hasReflection || !vEq(primitive.reflection, [1, 1, 1])) {
                // Loop through lights to get the surface color contribution for each light source, unless the objective is completely reflective.
                for (var j = 0; j < d.lights.length; j++) {
                    var light = d.lights[j];

                    // compute color based on Phong reflection model
                    // http://en.wikipedia.org/wiki/Phong_reflection_model
                    var hitPointToLight = v3Sub(light.center, result.hitPoint);  // L
                    var hitPointToLightN = vNormalize(hitPointToLight);
                    var hitPointToLightDist = vLen(hitPointToLight);

                    if (light.radius === 0 || !flags["SOFT_SHADOWS"]) {
                        if (checkLightRayForShadow(result, light, hitPointToLightN, hitPointToLightDist)) {
                            continue;
                        }
                    }
                    else {  // soft shadows. perturb the light source.
                        shadowSamples = shadowSamples || 32;

                        var shadowFactor = 0;

                        for (var lr = 0; lr < shadowSamples; lr ++) {
                            do {
                                var perturbation = [(Math.random() - 0.5) * light.radius + (light.radius / 2 * (lr % 2 == 0 ? 1 : -1)), 
                                    (Math.random() - 0.5) * light.radius + (light.radius / 2 * (lr % 4 == 0 ? 1 : -1)), 
                                    (Math.random() - 0.5) * light.radius + (light.radius / 2 * (lr % 8 == 0 ? 1 : -1))];
                            } while (vLen(perturbation) > light.radius);

                            var lr_hitPointToLight = v3Sub(vAdd(light.center, perturbation), result.hitPoint);
                            var lr_hitPointToLightN = vNormalize(lr_hitPointToLight);
                            var lr_hitPointToLightDist = vLen(lr_hitPointToLight);

                            if (!checkLightRayForShadow(result, light, lr_hitPointToLightN, lr_hitPointToLightDist))
                                shadowFactor++;
                        }

                        if (shadowFactor !== 0 && shadowFactor !== shadowSamples) {
                            for (var lr = 0; lr < shadowSamples * 7; lr ++) {
                                do {
                                    var perturbation = [(Math.random() - 0.5) * light.radius + (light.radius / 2 * (lr % 2 == 0 ? 1 : -1)), 
                                        (Math.random() - 0.5) * light.radius + (light.radius / 2 * (lr % 4 == 0 ? 1 : -1)), 
                                        (Math.random() - 0.5) * light.radius + (light.radius / 2 * (lr % 8 == 0 ? 1 : -1))];
                                } while (vLen(perturbation) > light.radius);

                                var lr_hitPointToLight = v3Sub(vAdd(light.center, perturbation), result.hitPoint);
                                var lr_hitPointToLightN = vNormalize(lr_hitPointToLight);
                                var lr_hitPointToLightDist = vLen(lr_hitPointToLight);

                                if (!checkLightRayForShadow(result, light, lr_hitPointToLightN, lr_hitPointToLightDist))
                                    shadowFactor++;
                            }
                            shadowSamples *= 8
                        }

                        if (shadowFactor === 0)
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

                    if (hasTexture) {
                        surfaceColor = vCompMultv(surfaceColor, textureColor);
                    }
                    if (light.radius !== 0 && flags["SOFT_SHADOWS"]) {
                        surfaceColor = vMult(surfaceColor, shadowFactor / shadowSamples);
                    }

                    if (!hasReflection)
                        color = vAdd(color, surfaceColor);
                    else {
                        color = vAdd(color, vCompMultv(surfaceColor, primitive.reflectionInv));
                    }
                    //color = [(result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128];
                    //if (primitive.id == "box3") {
                    //    color = [(result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128, (result.normal[2] + 1) * 128];
                    //    break;
                    //}
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

// Webworker code
onmessage = function(e) {
    if (e.data.action === "getPixel") {
        var color = getColorForRay(d.camera.position, e.data.ray, 0);
        postMessage({
            color: color,
            x: e.data.x,
            y: e.data.y
        });
    }
    else if (e.data.action === "getPixels") {
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
    else if (e.data.action === "getAntialiasedPixels") {
        var coords = e.data.coords;
        var data = [];
        for (var i in coords) {
            var x = coords[i][0];
            var y = coords[i][1];

            var rays = getMultiSampleRays(d.camera, x, y, width, height, max_x, max_y, flags["MULTISAMPLING_AMOUNT"]);
            var color = [0, 0, 0];
            for (var i = 0; i < rays.length; i++) {
                color = vAdd(color, vMult(getColorForRay(d.camera.position, rays[i], 0, flags["SOFT_SHADOWS_ALIASED_COUNT"]), 1/flags["MULTISAMPLING_AMOUNT"]));
            }
            data.push({
                x: x,
                y: y,
                color: color
            });
        }

        postMessage({
            action: "getAntialiasedPixels",
            pixels: data
        });
    }
    else if (e.data.action === "setD") {
        d = JSON.parse(e.data.d);
        max_x = e.data.max_x;
        max_y = e.data.max_y;
        width = e.data.width;
        height = e.data.height;
        textureData = e.data.textureData;
        normalMapData = e.data.normalMapData;
    }
}