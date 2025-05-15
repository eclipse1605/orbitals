class OrbitalApp {
    constructor() {
        console.log('OrbitalApp: Initializing...');

        this.canvas = document.getElementById('orbital-canvas');
        if (!this.canvas) console.error('OrbitalApp: Could not find orbital-canvas element');

        this.controlsPanel = document.getElementById('controls-panel');
        if (!this.controlsPanel) console.error('OrbitalApp: Could not find controls-panel element');

        console.log('OrbitalApp: Creating orbital calculator...');
        this.orbitalCalculator = new OrbitalCalculator();

        console.log('OrbitalApp: Creating renderer...');
        this.renderer = new OrbitalRenderer(this.canvas);

        console.log('OrbitalApp: Creating camera...');
        this.camera = new Camera(this.canvas);

        console.log('OrbitalApp: Creating color maps...');
        this.colorMaps = new ColorMaps();

        console.log('OrbitalApp: Initializing UI elements...');
        this.initUIElements();

        this.lastFrameTime = 0;
        this.isAnimating = true;

        console.log('OrbitalApp: Binding events...');
        this.bindEvents();

        console.log('OrbitalApp: Updating orbital...');
        this.updateOrbital();

        console.log('OrbitalApp: Starting animation loop...');
        this.animate();

        console.log('OrbitalApp: Initialization complete');
    }

    initUIElements() {

        this.nSlider = document.getElementById('n-value');
        this.lSlider = document.getElementById('l-value');
        this.mSlider = document.getElementById('m-value');
        this.nValueDisplay = document.getElementById('n-value-display');
        this.lValueDisplay = document.getElementById('l-value-display');
        this.mValueDisplay = document.getElementById('m-value-display');

        this.samplesSlider = document.getElementById('samples-value');
        this.samplesValueDisplay = document.getElementById('samples-value-display');

        this.colorMapSelect = document.getElementById('colormap');
        this.reverseColormapCheckbox = document.getElementById('reverse-colormap');

        this.displayBoxCheckbox = document.getElementById('display-box');
        this.autoRotateCheckbox = document.getElementById('auto-rotate');
        this.resetCameraButton = document.getElementById('reset-camera');

        this.backgroundSlider = document.getElementById('background-value');
        this.targetSlider = document.getElementById('target-value');
        this.deltaSlider = document.getElementById('delta-value');
        this.backgroundValueDisplay = document.getElementById('background-value-display');
        this.targetValueDisplay = document.getElementById('target-value-display');
        this.deltaValueDisplay = document.getElementById('delta-value-display');

        this.orbitalInfo = document.getElementById('orbital-info');
        this.pointsCount = document.getElementById('points-count');
        this.colormapScale = document.getElementById('colormap-scale');
        this.colormapInfo = document.getElementById('colormap-info');

        this.toggleControlsButton = document.getElementById('toggle-controls');
        this.closeControlsButton = document.getElementById('close-controls');
    }

    bindEvents() {

        this.nSlider.addEventListener('input', () => {
            const n = parseInt(this.nSlider.value);
            this.nValueDisplay.textContent = n;

            const oldL = parseInt(this.lSlider.value);
            this.lSlider.max = n - 1;

            if (oldL >= n) {
                this.lSlider.value = n - 1;
                this.lValueDisplay.textContent = n - 1;

                const oldM = parseInt(this.mSlider.value);
                const newL = n - 1;
                this.mSlider.min = -newL;
                this.mSlider.max = newL;

                if (Math.abs(oldM) > newL) {
                    this.mSlider.value = newL;
                    this.mValueDisplay.textContent = newL;
                }
            }

            this.updateOrbital();
        });

        this.lSlider.addEventListener('input', () => {
            const l = parseInt(this.lSlider.value);
            this.lValueDisplay.textContent = l;

            const oldM = parseInt(this.mSlider.value);
            this.mSlider.min = -l;
            this.mSlider.max = l;

            if (Math.abs(oldM) > l) {
                this.mSlider.value = l;
                this.mValueDisplay.textContent = l;
            }

            this.updateOrbital();
        });

        this.mSlider.addEventListener('input', () => {
            this.mValueDisplay.textContent = this.mSlider.value;
            this.updateOrbital();
        });

        this.samplesSlider.addEventListener('input', () => {
            this.samplesValueDisplay.textContent = this.samplesSlider.value;
            this.updateOrbital();
        });

        this.orbitalCalculator.setVisualizationMode('modulus');

        this.colorMapSelect.addEventListener('change', () => {
            console.log('Color map changed to:', this.colorMapSelect.value);
            this.renderer.setColorMap(this.colorMapSelect.value);

            if (typeof this.updateColormapScale === 'function') {
                this.updateColormapScale();
            }
        });

        this.reverseColormapCheckbox.addEventListener('change', () => {
            console.log('Reverse colormap changed to:', this.reverseColormapCheckbox.checked);
            this.renderer.reverseColorMap = this.reverseColormapCheckbox.checked;

            if (typeof this.updateColormapScale === 'function') {
                this.updateColormapScale();
            }
        });

        this.displayBoxCheckbox.addEventListener('change', () => {
            this.renderer.displayBox = this.displayBoxCheckbox.checked;
        });

        this.autoRotateCheckbox.addEventListener('change', () => {
            this.camera.autoRotate = this.autoRotateCheckbox.checked;
        });

        this.resetCameraButton.addEventListener('click', () => {
            this.camera.reset();
        });

        this.backgroundSlider.addEventListener('input', () => {
            const value = parseFloat(this.backgroundSlider.value);
            this.backgroundValueDisplay.textContent = value.toFixed(2);
            this.renderer.backgroundColor = value;
        });

        this.targetSlider.addEventListener('input', () => {
            const value = parseFloat(this.targetSlider.value);
            this.targetValueDisplay.textContent = value.toFixed(2);
            this.renderer.targetValueScale = value;
        });

        this.deltaSlider.addEventListener('input', () => {
            const value = parseFloat(this.deltaSlider.value);
            this.deltaValueDisplay.textContent = value.toFixed(2);
            this.renderer.deltaScale = value;
        });

        this.toggleControlsButton.addEventListener('click', () => {
            const controlsBody = document.getElementById('controls-body');
            if (controlsBody.style.display === 'none') {
                controlsBody.style.display = 'block';
                this.toggleControlsButton.textContent = 'Hide Controls';
            } else {
                controlsBody.style.display = 'none';
                this.toggleControlsButton.textContent = 'Show Controls';
            }
        });

        this.closeControlsButton.addEventListener('click', () => {
            document.getElementById('controls-body').style.display = 'none';
            this.toggleControlsButton.textContent = 'Show Controls';
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {

                this.navigateOrbital(-1);
            } else if (e.key === 'ArrowRight') {

                this.navigateOrbital(1);
            }
        });

        window.addEventListener('resize', () => {
            this.renderer.resize();
        });
    }

    updateOrbital() {
        try {

            const n = parseInt(this.nSlider?.value || 3);
            const l = parseInt(this.lSlider?.value || 1);
            const m = parseInt(this.mSlider?.value || 0);

            console.log(`Updating orbital with n=${n}, l=${l}, m=${m}`);

            this.orbitalCalculator.setVisualizationMode('modulus');

            this.orbitalCalculator.setOrbital(n, l, m);

            if (this.orbitalInfo) {
                this.orbitalInfo.textContent = `Orbital (n,l,m) = (${n},${l},${m}) — count: ${this.calculateSampleSize()}`;
            }

            this.generatePointCloud();

            if (this.camera && this.autoRotateCheckbox) {
                this.camera.autoRotate = this.autoRotateCheckbox.checked;
            }

            console.log('Orbital updated successfully');
        } catch (error) {
            console.error('Error updating orbital:', error);
        }
    }

    calculateSampleSize() {

        if (!this.samplesSlider) {
            return 10000;
        }

        const value = parseFloat(this.samplesSlider.value);
        return Math.floor(Math.pow(10, value));
    }

    generatePointCloud() {
        try {

            const sampleSize = this.calculateSampleSize();

            if (this.pointsCount) {
                this.pointsCount.textContent = sampleSize;
            }

            const pointCount = Math.max(10000, sampleSize);
            console.log(`Generating ${pointCount} points for visualization`);

            if (this.orbitalCalculator && this.renderer) {

                const result = this.orbitalCalculator.calculatePointCloud(pointCount);

                if (result && result.points && result.values) {

                    this.renderer.setPointCloud(
                        result.points,
                        result.values,
                        pointCount,
                        this.orbitalCalculator.boxSize,
                        this.orbitalCalculator.visualizationMode
                    );
                }
            }
        } catch (error) {
            console.error('Error generating point cloud:', error);
        }
    }

    updateColormapScale() {
        if (!this.colorMapSelect || !this.colormapScale) {
            return;
        }

        try {
            const mapName = this.colorMapSelect.value;
            const reverse = this.reverseColormapCheckbox?.checked || false;

            if (this.colorMaps && typeof this.colorMaps.generateGradient === 'function') {
                const gradient = this.colorMaps.generateGradient(mapName, 100, reverse);
                this.colormapScale.style.background = gradient;
            }
        } catch (error) {
            console.warn('Error updating colormap scale:', error);
        }
    }

    updateColormapInfo() {
        if (!this.colormapInfo || !this.orbitalCalculator) {
            return;
        }

        try {
            const mode = this.orbitalCalculator.visualizationMode;

            if (this.colorMaps && typeof this.colorMaps.getColormapAdvice === 'function') {
                this.colormapInfo.textContent = this.colorMaps.getColormapAdvice(mode);
            } else {

                this.colormapInfo.textContent = `Current mode: ${mode}`;
            }
        } catch (error) {
            console.warn('Error updating colormap info:', error);
        }
    }

    navigateOrbital(delta) {

        let n = parseInt(this.nSlider.value);
        let l = parseInt(this.lSlider.value);
        let m = parseInt(this.mSlider.value);

        m += delta;

        if (m > l) {

            m = -l - 1 + 1;
            l++;

            if (l >= n) {

                l = 0;
                n++;
                if (n > parseInt(this.nSlider.max)) {
                    n = 1;
                }
            }
        } else if (m < -l) {

            l--;

            if (l < 0) {

                n--;
                if (n < 1) {
                    n = parseInt(this.nSlider.max);
                }
                l = n - 1;
            }

            m = l;
        }

        this.nSlider.value = n;
        this.nValueDisplay.textContent = n;

        this.lSlider.max = n - 1;
        this.lSlider.value = l;
        this.lValueDisplay.textContent = l;

        this.mSlider.min = -l;
        this.mSlider.max = l;
        this.mSlider.value = m;
        this.mValueDisplay.textContent = m;

        this.updateOrbital();
    }

    updateColormapScale() {
        const mapName = this.colorMapSelect.value;
        const reverse = this.reverseColormapCheckbox.checked;

        const gradient = this.colorMaps.generateGradient(mapName, 100, reverse);
        this.colormapScale.style.background = gradient;
    }

    updateColormapInfo() {
        const mode = this.orbitalCalculator.visualizationMode;
        this.colormapInfo.textContent = this.colorMaps.getColormapAdvice(mode);
    }

    animate(timestamp) {
        try {

            timestamp = timestamp || performance.now();

            if (!this.lastFrameTime) this.lastFrameTime = timestamp;
            let deltaTime = timestamp - this.lastFrameTime;

            deltaTime = Math.min(deltaTime, 33);

            this.lastFrameTime = timestamp;

            if (!this._rotationAngle) this._rotationAngle = 0;
            if (this.camera && this.camera.autoRotate) {

                this._rotationAngle += 0.002;

                this._rotationAngle %= (Math.PI * 2);

                this.camera._totalAngle = this._rotationAngle;
            }

            if (this.camera) {
                this.camera.update(deltaTime);
            }

            if (this.renderer && this.renderer.gl) {
                this.renderer.render(this.camera, deltaTime);
            } else {
                console.error('Renderer not properly initialized in animation loop');
            }

            if (this.isAnimating) {
                window.requestAnimationFrame(this.animate.bind(this));
            }
        } catch (error) {
            console.error('Error in animation loop:', error);
            this.isAnimating = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Initializing Atomic Orbital Visualization application...");

        window.orbitalApp = new OrbitalApp();
        console.log("Application initialized successfully");
    } catch (error) {
        console.error("Error initializing application:", error);
        alert("An error occurred while initializing the application. See console for details.");
    }
});
