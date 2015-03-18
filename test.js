function runTests() {
    var totalTests = 0;
    var passedTests = 0;
    var failedTests = 0;

    var testExpect = function(v1, v2) {
        totalTests++;
        if(JSON.stringify(v1) !== JSON.stringify(v2)) {
            console.log("Test failed: ", v1, v2);
            failedTests++;
            return false;
        }
        passedTests++;
        return true;
    }

    testExpect(vAdd([1, 2, 3], [1, 2, 3]), [2, 4, 6]);
    testExpect(vSub([1, 2, 3], [1, 2, 3]), [0, 0, 0]);
    testExpect(vNeg([1, 2, -3]), [-1, -2, 3]);
    testExpect(vMult([1, 2, -3], 2), [2, 4, -6]);
    testExpect(vMult([-2, 2, 4], -1/2), [1, -1, -2]);
    testExpect(vLen([-2, 2, 4]), Math.sqrt(4 + 4 + 16));
    testExpect(vLen([1, -1, 1]), Math.sqrt(3));
    testExpect(vLen([Math.sqrt(1/3), Math.sqrt(1/3), Math.sqrt(1/3)]), 1);
    testExpect(vNormalize([-2, 2, 4]), [-2/Math.sqrt(4 + 4 + 16), 2/Math.sqrt(4 + 4 + 16), 4/Math.sqrt(4 + 4 + 16)]);
    testExpect(vNormalize([Math.sqrt(1/3), Math.sqrt(1/3), Math.sqrt(1/3)]), [Math.sqrt(1/3), Math.sqrt(1/3), Math.sqrt(1/3)]);
    testExpect(vDot([1, 1, 1], [2, 3, 4]), 2 + 3 + 4);
    testExpect(vDot([-2, 1, 2], [2, 3, 4]), -4 + 3 + 8);
    testExpect(vCross3([1, -3, 2], [3, 5, -3]), [-1, 9, 14]);

    testExpect(m4Multv3([[2, 1, -5, 4], [3, 2, -5, 7], [8, 3, -3, 0], [-2, 8, 6, 7]], [4, 9, 2]), [11, 27, 53]);
    testExpect(m4Multv4([[2, 1, 1, 0], [3, 2, -5, 7], [8, 3, -1, 0], [-2, 8, 6, 7]], [4, 9, 2, -3]), [19, -1, 57, 55]);
    testExpect(mMultm([[2, 1, 1, 0], [3, 2, -5, 7], [8, 3, -1, 0], [-2, 8, 6, 7]], [[2, 1, -5, 4], [3, 2, -5, 7], [8, 3, -3, 0], [-2, 8, 6, 7]]), 
        [[15, 7, -18, 15], [-42, 48, 32, 75], [17, 11, -52, 53], [54, 88, -6, 97]]);

    testExpect(degToRad(180), Math.PI);
    testExpect(radToDeg(Math.PI * 2), 360);

    console.log(passedTests + "/" + totalTests + " passed.");
}