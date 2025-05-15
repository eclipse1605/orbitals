class ColorMaps {
    constructor() {
        this.maps = {
            inferno: this.inferno.bind(this),
            viridis: this.viridis.bind(this),
            parula: this.parula.bind(this),
            gray: this.gray.bind(this),

            coolwarm: this.coolwarm.bind(this),
            turbo: this.turbo.bind(this),

            hsl: this.hsl.bind(this),
            twilight: this.twilight.bind(this)
        };
    }

    getMap(name) {
        return this.maps[name] || this.inferno;
    }

    mix(a, b, t) {
        return [
            a[0] * (1 - t) + b[0] * t,
            a[1] * (1 - t) + b[1] * t,
            a[2] * (1 - t) + b[2] * t
        ];
    }

    clamp(x) {
        return Math.max(0, Math.min(1, x));
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return [r, g, b];
    }

    inferno(t) {
        t = this.clamp(t);

        const colors = [
            [0.0, 0.0, 0.0],
            [0.5, 0.0, 0.4],
            [1.0, 0.4, 0.0],
            [1.0, 1.0, 0.0]
        ];

        if (t < 0.33) {
            return this.mix(colors[0], colors[1], t * 3);
        } else if (t < 0.66) {
            return this.mix(colors[1], colors[2], (t - 0.33) * 3);
        } else {
            return this.mix(colors[2], colors[3], (t - 0.66) * 3);
        }
    }

    viridis(t) {
        t = this.clamp(t);

        const colors = [
            [0.267, 0.004, 0.329],
            [0.127, 0.566, 0.550],
            [0.369, 0.788, 0.382],
            [0.993, 0.906, 0.144]
        ];

        if (t < 0.33) {
            return this.mix(colors[0], colors[1], t * 3);
        } else if (t < 0.66) {
            return this.mix(colors[1], colors[2], (t - 0.33) * 3);
        } else {
            return this.mix(colors[2], colors[3], (t - 0.66) * 3);
        }
    }

    parula(t) {
        t = this.clamp(t);

        const colors = [
            [0.208, 0.165, 0.529],
            [0.137, 0.518, 0.832],
            [0.090, 0.745, 0.812],
            [0.702, 0.867, 0.180],
            [0.988, 0.702, 0.106]
        ];

        if (t < 0.25) {
            return this.mix(colors[0], colors[1], t * 4);
        } else if (t < 0.5) {
            return this.mix(colors[1], colors[2], (t - 0.25) * 4);
        } else if (t < 0.75) {
            return this.mix(colors[2], colors[3], (t - 0.5) * 4);
        } else {
            return this.mix(colors[3], colors[4], (t - 0.75) * 4);
        }
    }

    gray(t) {
        t = this.clamp(t);
        return [t, t, t];
    }

    coolwarm(t) {
        t = this.clamp(t);

        const s = 2 * t - 1;

        if (s < 0) {
            return [0.0, 0.0, 0.5 * (1 + s)];
        } else {

            return [0.5 * (1 + s), 0.0, 0.0];
        }
    }

    turbo(t) {
        t = this.clamp(t);

        const colors = [
            [0.18995, 0.07176, 0.23217],
            [0.06748, 0.38195, 0.79287],
            [0.00000, 0.66093, 0.56590],
            [0.35749, 0.86890, 0.11561],
            [0.89267, 0.63571, 0.00000],
            [1.00000, 0.18739, 0.00000]
        ];

        const pos = t * 5;
        const idx = Math.floor(pos);
        const frac = pos - idx;

        if (idx >= 5) return colors[5];

        return this.mix(colors[idx], colors[idx + 1], frac);
    }

    hsl(t) {
        t = this.clamp(t);
        return this.hslToRgb(t, 1.0, 0.5);
    }

    twilight(t) {
        t = this.clamp(t);

        const colors = [
            [0.85, 0.10, 0.10],
            [0.65, 0.27, 0.45],
            [0.35, 0.45, 0.65],
            [0.25, 0.60, 0.85],
            [0.25, 0.60, 0.85],
            [0.35, 0.45, 0.65],
            [0.65, 0.27, 0.45],
            [0.85, 0.10, 0.10]
        ];

        const pos = t * 7;
        const idx = Math.floor(pos);
        const frac = pos - idx;

        if (idx >= 7) return colors[7];

        return this.mix(colors[idx], colors[idx + 1], frac);
    }

    generateGradient(mapName, steps = 100, reverse = false) {
        const colorMap = this.getMap(mapName);
        let gradient = '';

        for (let i = 0; i < steps; i++) {
            let t = i / (steps - 1);
            if (reverse) t = 1 - t;

            const color = colorMap(t);
            const r = Math.round(color[0] * 255);
            const g = Math.round(color[1] * 255);
            const b = Math.round(color[2] * 255);

            const percent = (i / (steps - 1)) * 100;
            gradient += `rgb(${r}, ${g}, ${b}) ${percent}%, `;
        }

        return `linear-gradient(to right, ${gradient.slice(0, -2)})`;
    }

    getColormapAdvice(mode) {
        switch (mode) {
            case 'real':
            case 'imaginary':
                return 'The adequate colormap for real/imaginary parts is a divergent one like coolwarm or turbo.';
            case 'modulus':
                return 'The adequate colormap for modulus is a sequential one like inferno.';
            case 'density':
                return 'The adequate colormap for probability density is a sequential one like viridis or parula.';
            case 'phase':
                return 'The adequate colormap for phase is a cyclic one like HSL or twilight.';
            case 'complex':
                return 'For complex values, a combination of HSL (phase) and brightness (modulus) works best.';
            default:
                return '';
        }
    }
}
