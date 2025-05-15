class OrbitalCalculator {
    constructor() {

        this.bohrRadius = 1.0;

        this.factorialCache = {};
        this.sphericalHarmonicCache = {};

        this.n = 2;
        this.l = 1;
        this.m = 1;

        this.visualizationMode = 'modulus';

        this.points = null;
        this.values = null;
        this.count = 0;

        this.boxSize = 40;
    }

    setOrbital(n, l, m) {

        n = Math.max(1, Math.min(20, parseInt(n)));
        l = Math.max(0, Math.min(n - 1, parseInt(l)));
        m = Math.max(-l, Math.min(l, parseInt(m)));

        const changed = (this.n !== n || this.l !== l || this.m !== m);

        this.n = n;
        this.l = l;
        this.m = m;

        return changed;
    }

    setVisualizationMode(mode) {
        const validModes = ['real', 'imaginary', 'modulus', 'density', 'phase', 'complex'];
        if (validModes.includes(mode)) {
            this.visualizationMode = mode;
            return true;
        }
        return false;
    }

    factorial(n) {
        if (n <= 1) return 1;
        if (this.factorialCache[n] !== undefined) return this.factorialCache[n];

        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }

        this.factorialCache[n] = result;
        return result;
    }

    doubleFactorial(n) {
        if (n <= 1) return 1;

        let result = n;
        let i = n - 2;
        while (i > 0) {
            result *= i;
            i -= 2;
        }

        return result;
    }

    associatedLegendre(l, m, x) {
        const absM = Math.abs(m);

        if (l < absM) return 0;

        if (l === 0 && m === 0) return 1;
        if (l === 1 && m === 0) return x;
        if (l === 1 && absM === 1) return -Math.sqrt(1 - x * x);

        if (absM === l) {
            const factor = Math.pow(-1, absM) * this.doubleFactorial(2 * absM - 1);
            return factor * Math.pow(1 - x * x, absM / 2);
        }

        if (absM === l - 1) {
            return x * (2 * l - 1) * this.associatedLegendre(l - 1, absM, x);
        }

        return (x * (2 * l - 1) * this.associatedLegendre(l - 1, absM, x) -
            (l + absM - 1) * this.associatedLegendre(l - 2, absM, x)) / (l - absM);
    }

    sphericalHarmonic(l, m, theta, phi) {
        const cacheKey = `${l}_${m}_${theta.toFixed(6)}_${phi.toFixed(6)}`;
        if (this.sphericalHarmonicCache[cacheKey] !== undefined) {
            return this.sphericalHarmonicCache[cacheKey];
        }

        const absM = Math.abs(m);

        const norm = Math.sqrt((2 * l + 1) * this.factorial(l - absM) /
            (4 * Math.PI * this.factorial(l + absM)));

        const legendre = this.associatedLegendre(l, absM, Math.cos(theta));

        const real = Math.cos(m * phi);
        const imag = Math.sin(m * phi);

        let result;
        if (m < 0 && m % 2 !== 0) {
            result = { real: -norm * legendre * real, imag: -norm * legendre * imag };
        } else {
            result = { real: norm * legendre * real, imag: norm * legendre * imag };
        }

        this.sphericalHarmonicCache[cacheKey] = result;
        return result;
    }

    laguerrePolynomial(n, alpha, x) {
        if (n === 0) return 1;
        if (n === 1) return 1 + alpha - x;

        let l0 = 1;
        let l1 = 1 + alpha - x;

        for (let i = 1; i < n; i++) {
            const l2 = ((2 * i + 1 + alpha - x) * l1 - (i + alpha) * l0) / (i + 1);
            l0 = l1;
            l1 = l2;
        }

        return l1;
    }

    radialFunction(n, l, r) {

        const norm = Math.sqrt(
            (2 / (n * this.bohrRadius)) *
            this.factorial(n - l - 1) /
            (2 * n * this.factorial(n + l))
        );

        const rho = (2 * r) / (n * this.bohrRadius);
        const expTerm = Math.exp(-rho / 2);

        const polyTerm = Math.pow(rho, l) * this.laguerrePolynomial(n - l - 1, 2 * l + 1, rho);

        return norm * expTerm * polyTerm;
    }

    wavefunction(n, l, m, r, theta, phi) {

        const radial = this.radialFunction(n, l, r);
        const angular = this.sphericalHarmonic(l, m, theta, phi);

        return {
            real: radial * angular.real,
            imag: radial * angular.imag
        };
    }

    evaluateWavefunction(n, l, m, x, y, z) {

        const r = Math.sqrt(x * x + y * y + z * z);

        if (r < 1e-10) {

            if (l === 0) {
                const radial = this.radialFunction(n, 0, 0);
                const norm = Math.sqrt(1 / (4 * Math.PI));
                return { real: radial * norm, imag: 0 };
            } else {
                return { real: 0, imag: 0 };
            }
        }

        const theta = Math.acos(z / r);
        const phi = Math.atan2(y, x);

        return this.wavefunction(n, l, m, r, theta, phi);
    }

    generatePointCloud(numSamples = 10000) {
        console.log(`Generating ${numSamples} points for orbital (${this.n},${this.l},${this.m})...`);

        this.points = new Float32Array(numSamples * 3);
        this.values = new Float32Array(numSamples * 4);
        this.count = numSamples;

        let x = (Math.random() - 0.5) * this.boxSize;
        let y = (Math.random() - 0.5) * this.boxSize;
        let z = (Math.random() - 0.5) * this.boxSize;

        let stepSize = this.n * this.bohrRadius / 5;

        const burnIn = Math.min(5000, numSamples / 10);

        let accepted = 0;
        let total = 0;

        for (let i = -burnIn; i < numSamples; i++) {

            const dx = (Math.random() - 0.5) * stepSize;
            const dy = (Math.random() - 0.5) * stepSize;
            const dz = (Math.random() - 0.5) * stepSize;

            const xNew = x + dx;
            const yNew = y + dy;
            const zNew = z + dz;

            const psiCurrent = this.evaluateWavefunction(this.n, this.l, this.m, x, y, z);
            const psiNew = this.evaluateWavefunction(this.n, this.l, this.m, xNew, yNew, zNew);

            const densityCurrent = psiCurrent.real * psiCurrent.real + psiCurrent.imag * psiCurrent.imag;
            const densityNew = psiNew.real * psiNew.real + psiNew.imag * psiNew.imag;

            let accept = false;
            if (densityNew >= densityCurrent) {
                accept = true;
            } else {
                const acceptanceRatio = densityNew / densityCurrent;
                accept = Math.random() < acceptanceRatio;
            }

            if (accept) {
                x = xNew;
                y = yNew;
                z = zNew;
                accepted++;
            }

            total++;

            if (i >= 0) {
                const idx = i * 3;
                const valIdx = i * 4;

                this.points[idx] = x;
                this.points[idx + 1] = y;
                this.points[idx + 2] = z;

                const psi = this.evaluateWavefunction(this.n, this.l, this.m, x, y, z);
                const modulus = Math.sqrt(psi.real * psi.real + psi.imag * psi.imag);
                const phase = Math.atan2(psi.imag, psi.real);

                this.values[valIdx] = psi.real;
                this.values[valIdx + 1] = psi.imag;
                this.values[valIdx + 2] = modulus;
                this.values[valIdx + 3] = phase;
            }

            if (i < 0 && i % 500 === 0 && total > 0) {
                const acceptanceRate = accepted / total;
                if (acceptanceRate < 0.3) {
                    stepSize *= 0.9;
                } else if (acceptanceRate > 0.5) {
                    stepSize *= 1.1;
                }
            }
        }

        console.log(`Generated ${numSamples} points with acceptance rate: ${(accepted / total * 100).toFixed(1)}%`);
        return this.points;
    }

    getPointValues() {
        if (!this.values || !this.points) return null;

        const result = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            const valIdx = i * 4;
            const real = this.values[valIdx];
            const imag = this.values[valIdx + 1];
            const modulus = this.values[valIdx + 2];
            const phase = this.values[valIdx + 3];

            switch (this.visualizationMode) {
                case 'real':

                    result[i] = real;
                    break;

                case 'imaginary':

                    result[i] = imag;
                    break;

                case 'modulus':

                    result[i] = modulus;
                    break;

                case 'density':

                    result[i] = modulus * modulus;
                    break;

                case 'phase':

                    result[i] = (phase + Math.PI) / (2 * Math.PI);
                    break;

                case 'complex':

                    result[i] = modulus;
                    break;

                default:

                    result[i] = modulus;
            }
        }

        if (this.visualizationMode === 'phase') {

            return result;
        } else if (this.visualizationMode === 'real' || this.visualizationMode === 'imaginary') {

            let maxAbs = 0;
            for (let i = 0; i < this.count; i++) {
                maxAbs = Math.max(maxAbs, Math.abs(result[i]));
            }

            if (maxAbs === 0) return result;

            for (let i = 0; i < this.count; i++) {

                result[i] = result[i] / maxAbs;

                result[i] = (result[i] + 1) / 2;
            }
        } else {

            let min = Number.MAX_VALUE;
            let max = Number.MIN_VALUE;

            for (let i = 0; i < this.count; i++) {
                min = Math.min(min, result[i]);
                max = Math.max(max, result[i]);
            }

            if (min === max) return result;

            const range = max - min;
            for (let i = 0; i < this.count; i++) {
                result[i] = (result[i] - min) / range;
            }
        }

        return result;
    }

    getPhaseValues() {
        if (!this.values || !this.points || this.visualizationMode !== 'complex') return null;

        const result = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            const valIdx = i * 4;
            const phase = this.values[valIdx + 3];
            result[i] = (phase + Math.PI) / (2 * Math.PI);
        }

        return result;
    }

    calculatePointCloud(numPoints) {
        console.log(`OrbitalCalculator: Calculating point cloud with ${numPoints} points...`);

        this.generatePointCloud(numPoints);

        const values = this.getPointValues();

        this.boxSize = 20 * this.n;

        return {
            points: this.points,
            values: values
        };
    }
}
