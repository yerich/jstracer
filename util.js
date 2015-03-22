e = 0.00000000001;

usePartitions = true;
useWorkers = true;
lineSkip = 5;
numWorkers = 8;
postMessageCalls = 0;
reflection = true;
maxReflections = 10;
refraction = true;

log = function(m, r, reset) {
    if (!r) return console.log(m);
    if (!window.rlog || reset) {
        window.rlog = Math.random();
    }
    if (window.rlog < r) return console.log(m);
    return false;
}

vAdd = function(v1, v2) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        result[i] = v1[i] + v2[i];
    }
    return result;
}

vAdd3 = function(v1, v2, v3) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        result[i] = v1[i] + v2[i] + v3[i];
    }
    return result;
}

vSub = function(v1, v2) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        result[i] = v1[i] - v2[i];
    }
    return result;
}

v3Sub = function(v1, v2) {
    return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
}

vNeg = function(v1) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        result[i] = -v1[i];
    }
    return result;
}

vEq = function(v1, v2) {
    for (var i = 0; i < v1.length; i++) {
        if (v1[i] != v2[i]) return false;
    }
    return true;
}

vInv = function(v1) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        if (v1[i] === 0)
            result[i] = 1000000000000000000000000000000000;
        else
            result[i] = 1/v1[i];
    }
    return result;
}

vMult = function(v1, c) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        result[i] = c * v1[i];
    }
    return result;
}

vCompMultv = function(v1, v2) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        result[i] = v1[i] * v2[i];
    }
    return result;
}

vMax = function(v1, v2) {
    var result = [];
    for (var i = 0; i < v1.length; i++) {
        result[i] = Math.max(v2[i], v1[i]);
    }
    return result;
}

vLen = function(v1) {
    var sum = 0.0;
    for (var i = 0; i < v1.length; i++) {
        sum += v1[i] * v1[i];
    }
    return Math.sqrt(sum);
}

vNormalize = function(v1) {
    return vMult(v1, 1/vLen(v1));
}

vDot = function(v1, v2) {
    var result = 0;
    for (var i = 0; i < v1.length; i++) {
        result += v1[i] * v2[i];
    }
    return result;
}

vCross3 = function(v1, v2) {
    return [v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]];
}

m4Multv3 = function(m, v) {
    return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2] + m[0][3],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2] + m[1][3],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2] + m[2][3]];
}

m4Multv4 = function(m, v) {
    return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2] + m[0][3] * v[3],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2] + m[1][3] * v[3],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2] + m[2][3] * v[3],
            m[3][0] * v[0] + m[3][1] * v[1] + m[3][2] * v[2] + m[3][3] * v[3]];
}

m4Inverse = function(m) {
    r = m4();
    r[0][0] = m[1][1]*m[2][2]*m[3][3] - m[1][1]*m[3][2]*m[2][3] - m[1][2]*m[2][1]*m[3][3] + m[1][2]*m[3][1]*m[2][3] + m[1][3]*m[2][1]*m[3][2] - m[1][3]*m[3][1]*m[2][2];
    r[0][1] = -m[0][1]*m[2][2]*m[3][3] + m[0][1]*m[3][2]*m[2][3] + m[0][2]*m[2][1]*m[3][3] - m[0][2]*m[3][1]*m[2][3] - m[0][3]*m[2][1]*m[3][2] + m[0][3]*m[3][1]*m[2][2];
    r[0][2] = m[0][1]*m[1][2]*m[3][3] - m[0][1]*m[3][2]*m[1][3] - m[0][2]*m[1][1]*m[3][3] + m[0][2]*m[3][1]*m[1][3] + m[0][3]*m[1][1]*m[3][2] - m[0][3]*m[3][1]*m[1][2];
    r[0][3] = -m[0][1]*m[1][2]*m[2][3] + m[0][1]*m[2][2]*m[1][3] + m[0][2]*m[1][1]*m[2][3] - m[0][2]*m[2][1]*m[1][3] - m[0][3]*m[1][1]*m[2][2] + m[0][3]*m[2][1]*m[1][2];

    r[1][0] = -m[1][0]*m[2][2]*m[3][3] + m[1][0]*m[3][2]*m[2][3] + m[1][2]*m[2][0]*m[3][3] - m[1][2]*m[3][0]*m[2][3] - m[1][3]*m[2][0]*m[3][2] + m[1][3]*m[3][0]*m[2][2];
    r[1][1] = m[0][0]*m[2][2]*m[3][3] - m[0][0]*m[3][2]*m[2][3] - m[0][2]*m[2][0]*m[3][3] + m[0][2]*m[3][0]*m[2][3] + m[0][3]*m[2][0]*m[3][2] - m[0][3]*m[3][0]*m[2][2];
    r[1][2] = -m[0][0]*m[1][2]*m[3][3] + m[0][0]*m[3][2]*m[1][3] + m[0][2]*m[1][0]*m[3][3] - m[0][2]*m[3][0]*m[1][3] - m[0][3]*m[1][0]*m[3][2] + m[0][3]*m[3][0]*m[1][2];
    r[1][3] = m[0][0]*m[1][2]*m[2][3] - m[0][0]*m[2][2]*m[1][3] - m[0][2]*m[1][0]*m[2][3] + m[0][2]*m[2][0]*m[1][3] + m[0][3]*m[1][0]*m[2][2] - m[0][3]*m[2][0]*m[1][2];

    r[2][0] = m[1][0]*m[2][1]*m[3][3] - m[1][0]*m[3][1]*m[2][3] - m[1][1]*m[2][0]*m[3][3] + m[1][1]*m[3][0]*m[2][3] + m[1][3]*m[2][0]*m[3][1] - m[1][3]*m[3][0]*m[2][1];
    r[2][1] = -m[0][0]*m[2][1]*m[3][3] + m[0][0]*m[3][1]*m[2][3] + m[0][1]*m[2][0]*m[3][3] - m[0][1]*m[3][0]*m[2][3] - m[0][3]*m[2][0]*m[3][1] + m[0][3]*m[3][0]*m[2][1];
    r[2][2] = m[0][0]*m[1][1]*m[3][3] - m[0][0]*m[3][1]*m[1][3] - m[0][1]*m[1][0]*m[3][3] + m[0][1]*m[3][0]*m[1][3] + m[0][3]*m[1][0]*m[3][1] - m[0][3]*m[3][0]*m[1][1];
    r[2][3] = -m[0][0]*m[1][1]*m[2][3] + m[0][0]*m[2][1]*m[1][3] + m[0][1]*m[1][0]*m[2][3] - m[0][1]*m[2][0]*m[1][3] - m[0][3]*m[1][0]*m[2][1] + m[0][3]*m[2][0]*m[1][1];

    r[3][0] = -m[1][0]*m[2][1]*m[3][2] + m[1][0]*m[3][1]*m[2][2] + m[1][1]*m[2][0]*m[3][2] - m[1][1]*m[3][0]*m[2][2] - m[1][2]*m[2][0]*m[3][1] + m[1][2]*m[3][0]*m[2][1];
    r[3][1] = m[0][0]*m[2][1]*m[3][2] - m[0][0]*m[3][1]*m[2][2] - m[0][1]*m[2][0]*m[3][2] + m[0][1]*m[3][0]*m[2][2] + m[0][2]*m[2][0]*m[3][1] - m[0][2]*m[3][0]*m[2][1];
    r[3][2] = -m[0][0]*m[1][1]*m[3][2] + m[0][0]*m[3][1]*m[1][2] + m[0][1]*m[1][0]*m[3][2] - m[0][1]*m[3][0]*m[1][2] - m[0][2]*m[1][0]*m[3][1] + m[0][2]*m[3][0]*m[1][1];
    r[3][3] = m[0][0]*m[1][1]*m[2][2] - m[0][0]*m[2][1]*m[1][2] - m[0][1]*m[1][0]*m[2][2] + m[0][1]*m[2][0]*m[1][2] + m[0][2]*m[1][0]*m[2][1] - m[0][2]*m[2][0]*m[1][1];

    var det = m[0][0]*r[0][0] + m[0][1]*r[1][0] + m[0][2]*r[2][0] + m[0][3]*r[3][0];
    for (var i = 0; i < 16; i++) r[i/4 | 0][i % 4] /= det;
    return r;
}

// http://blog.acipo.com/matrix-inversion-in-javascript/
mInverse = function(M){
    // I use Guassian Elimination to calculate the inverse:
    // (1) 'augment' the matrix (left) by the identity (on the right)
    // (2) Turn the matrix on the left into the identity by elemetry row ops
    // (3) The matrix on the right is the inverse (was the identity matrix)
    // There are 3 elemtary row ops: (I combine b and c in my code)
    // (a) Swap 2 rows
    // (b) Multiply a row by a scalar
    // (c) Add 2 rows
    
    //if the matrix isn't square: exit (error)
    if(M.length !== M[0].length){return;}
    
    //create the identity matrix (I), and a copy (C) of the original
    var i=0, ii=0, j=0, dim=M.length, e=0, t=0;
    var I = [], C = [];
    for(i=0; i<dim; i+=1){
        // Create the row
        I[I.length]=[];
        C[C.length]=[];
        for(j=0; j<dim; j+=1){
            
            //if we're on the diagonal, put a 1 (for identity)
            if(i==j){ I[i][j] = 1; }
            else{ I[i][j] = 0; }
            
            // Also, make the copy of the original
            C[i][j] = M[i][j];
        }
    }
    
    // Perform elementary row operations
    for(i=0; i<dim; i+=1){
        // get the element e on the diagonal
        e = C[i][i];
        
        // if we have a 0 on the diagonal (we'll need to swap with a lower row)
        if(e==0){
            //look through every row below the i'th row
            for(ii=i+1; ii<dim; ii+=1){
                //if the ii'th row has a non-0 in the i'th col
                if(C[ii][i] != 0){
                    //it would make the diagonal have a non-0 so swap it
                    for(j=0; j<dim; j++){
                        e = C[i][j];       //temp store i'th row
                        C[i][j] = C[ii][j];//replace i'th row by ii'th
                        C[ii][j] = e;      //repace ii'th by temp
                        e = I[i][j];       //temp store i'th row
                        I[i][j] = I[ii][j];//replace i'th row by ii'th
                        I[ii][j] = e;      //repace ii'th by temp
                    }
                    //don't bother checking other rows since we've swapped
                    break;
                }
            }
            //get the new diagonal
            e = C[i][i];
            //if it's still 0, not invertable (error)
            if(e==0){return}
        }
        
        // Scale this row down by e (so we have a 1 on the diagonal)
        for(j=0; j<dim; j++){
            C[i][j] = C[i][j]/e; //apply to original matrix
            I[i][j] = I[i][j]/e; //apply to identity
        }
        
        // Subtract this row (scaled appropriately for each row) from ALL of
        // the other rows so that there will be 0's in this column in the
        // rows above and below this one
        for(ii=0; ii<dim; ii++){
            // Only apply to other rows (we want a 1 on the diagonal)
            if(ii==i){continue;}
            
            // We want to change this element to 0
            e = C[ii][i];
            
            // Subtract (the row above(or below) scaled by e) from (the
            // current row) but start at the i'th column and assume all the
            // stuff left of diagonal is 0 (which it should be if we made this
            // algorithm correctly)
            for(j=0; j<dim; j++){
                C[ii][j] -= e*C[i][j]; //apply to original matrix
                I[ii][j] -= e*I[i][j]; //apply to identity
            }
        }
    }
    
    //we've done all operations, C should be the identity
    //matrix I should be the inverse:
    return I;
}


m4 = function() {
    return [[1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]];
}

mTranslate = function(dx, dy, dz, m) {
    return mMultm(
        [[1, 0, 0, dx],
         [0, 1, 0, dy],
         [0, 0, 1, dz],
         [0, 0, 0, 1]], m);
}

mScale = function(sx, sy, sz, m) {
    return mMultm(
        [[sx, 0, 0, 0],
         [0, sy, 0, 0],
         [0, 0, sz, 0],
         [0, 0, 0, 1]], m);
}

mRotate = function(axis, angle, m) {
    var r = degToRad(angle);
    if (axis === "x") {
        return mMultm(
            [[1, 0, 0, 0],
             [0, Math.cos(r), -Math.sin(r), 0],
             [0, Math.sin(r), Math.cos(r), 0],
             [0, 0, 0, 1]], m);
    }
    else if (axis === "y") {
        return mMultm(
            [[Math.cos(r), 0, Math.sin(r), 0],
             [0, 1, 0, 0],
             [-Math.sin(r), 0, Math.cos(r), 0],
             [0, 0, 0, 1]], m);
    }
    else if (axis === "z") {
        return mMultm(
            [[Math.cos(r), -Math.sin(r), 0, 0],
             [Math.sin(r), Math.cos(r), 0, 0],
             [0, 0, 1, 0],
             [0, 0, 0, 1]], m);
    }
    return m;
}

mMultm = function(m1, m2) {
    var result = [];
    for (var i = 0; i < m1.length; i++) {
        result[i] = [];
        for (var j = 0; j < m2[0].length; j++) {
            result[i][j] = 0;
            for (var k = 0; k < m1[0].length; k++) {
                result[i][j] += m1[i][k] * m2[k][j];
            }
        }
    }
    return result;
}

degToRad = function(angle) {
    return angle * Math.PI / 180;
}

radToDeg = function(angle) {
    return angle * 180 / Math.PI;
}

mTransInv = function(primitive) {
    if (!primitive.mTransInv) {
        if (!primitive.mTrans) {
            primitive.mTrans = m4();
        }
        primitive.mTransInv = m4Inverse(primitive.mTrans);
    }
    return primitive.mTransInv;
};

mTransNoTranslateInv = function(primitive) {
    if (!primitive.mTransNoTranslateInv) {
        if (!primitive.mTransNoTranslate) {
            primitive.mTransNoTranslate = m4();
        }
        primitive.mTransNoTranslateInv = m4Inverse(primitive.mTransNoTranslate);
    }
    return primitive.mTransNoTranslateInv;
};

mTransNoScaleInv = function(primitive) {
    if (!primitive.mTransNoScaleInv) {
        if (!primitive.mTransNoScale) {
            primitive.mTransNoScale = m4();
        }
        primitive.mTransNoScaleInv = m4Inverse(primitive.mTransNoScale);
    }
    return primitive.mTransNoScaleInv;
};