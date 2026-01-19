export class Matrix4 {
    constructor() {
        this.elements = new Float32Array(16)
        this.identity()
    }

    identity() {
        const e = this.elements
        e[0] = 1; e[4] = 0; e[8] = 0; e[12] = 0
        e[1] = 0; e[5] = 1; e[9] = 0; e[13] = 0
        e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0
        e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1
        return this
    }

    copy(m) {
        const te = this.elements
        const me = m.elements
        for (let i = 0; i < 16; i++) {
            te[i] = me[i]
        }
        return this
    }

    clone() {
        return new Matrix4().copy(this)
    }

    multiply(m) {
        return this.multiplyMatrices(this, m)
    }

    premultiply(m) {
        return this.multiplyMatrices(m, this)
    }

    multiplyMatrices(a, b) {
        const ae = a.elements
        const be = b.elements
        const te = this.elements

        const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12]
        const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13]
        const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14]
        const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15]

        const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12]
        const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13]
        const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14]
        const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15]

        te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
        te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
        te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
        te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44

        te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
        te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
        te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
        te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44

        te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
        te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
        te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
        te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44

        te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
        te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
        te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
        te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44

        return this
    }

    translate(x, y, z) {
        const te = this.elements
        te[12] += te[0] * x + te[4] * y + te[8] * z
        te[13] += te[1] * x + te[5] * y + te[9] * z
        te[14] += te[2] * x + te[6] * y + te[10] * z
        te[15] += te[3] * x + te[7] * y + te[11] * z
        return this
    }

    rotateX(angle) {
        const c = Math.cos(angle)
        const s = Math.sin(angle)
        const te = this.elements

        const a12 = te[4], a13 = te[8]
        const a22 = te[5], a23 = te[9]
        const a32 = te[6], a33 = te[10]
        const a42 = te[7], a43 = te[11]

        te[4] = a12 * c + a13 * s
        te[5] = a22 * c + a23 * s
        te[6] = a32 * c + a33 * s
        te[7] = a42 * c + a43 * s

        te[8] = a13 * c - a12 * s
        te[9] = a23 * c - a22 * s
        te[10] = a33 * c - a32 * s
        te[11] = a43 * c - a42 * s

        return this
    }

    rotateY(angle) {
        const c = Math.cos(angle)
        const s = Math.sin(angle)
        const te = this.elements

        const a11 = te[0], a13 = te[8]
        const a21 = te[1], a23 = te[9]
        const a31 = te[2], a33 = te[10]
        const a41 = te[3], a43 = te[11]

        te[0] = a11 * c - a13 * s
        te[1] = a21 * c - a23 * s
        te[2] = a31 * c - a33 * s
        te[3] = a41 * c - a43 * s

        te[8] = a11 * s + a13 * c
        te[9] = a21 * s + a23 * c
        te[10] = a31 * s + a33 * c
        te[11] = a41 * s + a43 * c

        return this
    }

    rotateZ(angle) {
        const c = Math.cos(angle)
        const s = Math.sin(angle)
        const te = this.elements

        const a11 = te[0], a12 = te[4]
        const a21 = te[1], a22 = te[5]
        const a31 = te[2], a32 = te[6]
        const a41 = te[3], a42 = te[7]

        te[0] = a11 * c + a12 * s
        te[1] = a21 * c + a22 * s
        te[2] = a31 * c + a32 * s
        te[3] = a41 * c + a42 * s

        te[4] = a12 * c - a11 * s
        te[5] = a22 * c - a21 * s
        te[6] = a32 * c - a31 * s
        te[7] = a42 * c - a41 * s

        return this
    }

    scale(x, y, z) {
        const te = this.elements
        te[0] *= x; te[4] *= y; te[8] *= z
        te[1] *= x; te[5] *= y; te[9] *= z
        te[2] *= x; te[6] *= y; te[10] *= z
        te[3] *= x; te[7] *= y; te[11] *= z
        return this
    }

    perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2)
        const nf = 1 / (near - far)
        const te = this.elements

        te[0] = f / aspect
        te[1] = 0
        te[2] = 0
        te[3] = 0

        te[4] = 0
        te[5] = f
        te[6] = 0
        te[7] = 0

        te[8] = 0
        te[9] = 0
        te[10] = (far + near) * nf
        te[11] = -1

        te[12] = 0
        te[13] = 0
        te[14] = 2 * far * near * nf
        te[15] = 0

        return this
    }

    orthographic(left, right, bottom, top, near, far) {
        const te = this.elements
        const w = 1.0 / (right - left)
        const h = 1.0 / (top - bottom)
        const p = 1.0 / (far - near)

        te[0] = 2 * w
        te[1] = 0
        te[2] = 0
        te[3] = 0

        te[4] = 0
        te[5] = 2 * h
        te[6] = 0
        te[7] = 0

        te[8] = 0
        te[9] = 0
        te[10] = -2 * p
        te[11] = 0

        te[12] = -(right + left) * w
        te[13] = -(top + bottom) * h
        te[14] = -(far + near) * p
        te[15] = 1

        return this
    }

    lookAt(eyeX, eyeY, eyeZ, targetX, targetY, targetZ, upX, upY, upZ) {
        let fx = targetX - eyeX
        let fy = targetY - eyeY
        let fz = targetZ - eyeZ

        let len = Math.sqrt(fx * fx + fy * fy + fz * fz)
        fx /= len; fy /= len; fz /= len

        let sx = fy * upZ - fz * upY
        let sy = fz * upX - fx * upZ
        let sz = fx * upY - fy * upX

        len = Math.sqrt(sx * sx + sy * sy + sz * sz)
        sx /= len; sy /= len; sz /= len

        const ux = sy * fz - sz * fy
        const uy = sz * fx - sx * fz
        const uz = sx * fy - sy * fx

        const te = this.elements
        te[0] = sx; te[4] = sy; te[8] = sz; te[12] = 0
        te[1] = ux; te[5] = uy; te[9] = uz; te[13] = 0
        te[2] = -fx; te[6] = -fy; te[10] = -fz; te[14] = 0
        te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1

        return this.translate(-eyeX, -eyeY, -eyeZ)
    }

    invert() {
        const te = this.elements
        const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3]
        const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7]
        const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11]
        const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15]

        const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44
        const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44
        const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44
        const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34

        const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14

        if (det === 0) {
            return this.identity()
        }

        const detInv = 1 / det

        te[0] = t11 * detInv
        te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv
        te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv
        te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv

        te[4] = t12 * detInv
        te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv
        te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv
        te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv

        te[8] = t13 * detInv
        te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv
        te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv
        te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv

        te[12] = t14 * detInv
        te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv
        te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv
        te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv

        return this
    }

    transpose() {
        const te = this.elements
        let tmp

        tmp = te[1]; te[1] = te[4]; te[4] = tmp
        tmp = te[2]; te[2] = te[8]; te[8] = tmp
        tmp = te[6]; te[6] = te[9]; te[9] = tmp
        tmp = te[3]; te[3] = te[12]; te[12] = tmp
        tmp = te[7]; te[7] = te[13]; te[13] = tmp
        tmp = te[11]; te[11] = te[14]; te[14] = tmp

        return this
    }
}
