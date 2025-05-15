class OrbitalRenderer {
    constructor(canvas) {
        console.log('OrbitalRenderer: Initializing with canvas:', canvas);
        if (!canvas) {
            console.error('OrbitalRenderer: Canvas is null or undefined');
            alert('Error: Canvas element not found');
            return;
        }

        try {
            this.canvas = canvas;
            console.log('OrbitalRenderer: Getting WebGL2 context...');

            const contextOptions = {
                alpha: false,
                depth: true,
                stencil: false,
                antialias: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false
            };

            console.log('OrbitalRenderer: Requesting WebGL2 with high-performance GPU...');
            this.gl = canvas.getContext('webgl2', contextOptions);

            if (!this.gl) {
                console.error('OrbitalRenderer: WebGL2 not supported');

                this.gl = canvas.getContext('webgl', contextOptions) ||
                    canvas.getContext('experimental-webgl', contextOptions);
                if (!this.gl) {
                    alert('WebGL not supported. Please use a modern browser.');
                    return;
                }
                console.log('OrbitalRenderer: Using fallback WebGL 1');
            } else {
                console.log('OrbitalRenderer: WebGL2 context created successfully');
            }
        } catch (e) {
            console.error('OrbitalRenderer: Error initializing WebGL:', e);
            alert('Error initializing WebGL. See console for details.');
            return;
        }

        this.initGL();

        this.pointProgram = null;
        this.boxProgram = null;

        this.initShaders();

        this.pointBuffer = this.gl.createBuffer();
        this.valueBuffer = this.gl.createBuffer();
        this.phaseBuffer = this.gl.createBuffer();

        this.boxBuffer = this.gl.createBuffer();
        this.boxIndexBuffer = this.gl.createBuffer();

        this.initBoxGeometry();

        this.colorMap = 'inferno';
        this.reverseColorMap = false;

        this.displayBox = false;
        this.backgroundColor = 0.85;
        this.targetValueScale = 0.5;
        this.deltaScale = 0.5;

        this.colormaps = new ColorMaps();

        this.pointCount = 0;
        this.pointsArray = null;
        this.valuesArray = null;
        this.phaseArray = null;

        this.complexMode = false;
    }

    initGL() {
        const gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        gl.disable(gl.DITHER);
        gl.disable(gl.CULL_FACE);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);

        this.enableOptimalExtensions(gl);

        if (gl.hint) {

            gl.hint(gl.GENERATE_MIPMAP_HINT, gl.FASTEST);
            if (gl.FRAGMENT_SHADER_DERIVATIVE_HINT) {
                gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.FASTEST);
            }
        }

        gl.clearColor(0.85, 0.85, 0.85, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        console.log('GPU-optimized WebGL context initialized');
    }

    enableOptimalExtensions(gl) {

        const extensions = [
            'WEBGL_draw_buffers',
            'OES_element_index_uint',
            'OES_texture_float',
            'OES_texture_float_linear',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'WEBGL_depth_texture',
            'EXT_frag_depth',
            'EXT_shader_texture_lod',
            'EXT_disjoint_timer_query',
            'ANGLE_instanced_arrays',
            'OES_vertex_array_object'
        ];

        console.log('Enabling WebGL extensions for optimal GPU performance:');
        for (const ext of extensions) {
            const extension = gl.getExtension(ext);
            if (extension) {
                console.log(`  ✓ ${ext} enabled`);
                this[ext.replace(/\W/g, '_')] = extension;
            } else {
                console.log(`  ✗ ${ext} not available`);
            }
        }

        if (gl instanceof WebGL2RenderingContext) {
            console.log('WebGL2 detected, enabling additional extensions:');
            const webgl2Extensions = [
                'EXT_color_buffer_float',
                'EXT_texture_filter_anisotropic'
            ];

            for (const ext of webgl2Extensions) {
                const extension = gl.getExtension(ext);
                if (extension) {
                    console.log(`  ✓ ${ext} enabled`);
                    this[ext.replace(/\W/g, '_')] = extension;
                } else {
                    console.log(`  ✗ ${ext} not available`);
                }
            }
        }
    }

    resize() {

        const pixelRatio = window.devicePixelRatio || 1;

        const width = this.canvas.clientWidth * pixelRatio;
        const height = this.canvas.clientHeight * pixelRatio;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.gl.viewport(0, 0, width, height);
        }
    }

    initShaders() {
        const gl = this.gl;

        const pointVertexShader = `#version 300 es
            precision highp float;

            in vec3 aPosition;
            in float aValue;
            in float aPhase;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform float uPointSize;
            uniform float uRotationAngle; 

            out float vValue;
            out float vPhase;
            out vec3 vViewPosition;
            out vec3 vOriginalPosition; 

            void main() {

                vec3 pos = aPosition;

                float distFromCenter = length(pos);

                float speedFactor = 1.0 + (10.0 / (distFromCenter + 0.5));

                float angle = uRotationAngle * speedFactor;
                float cosA = cos(angle);
                float sinA = sin(angle);

                vec3 rotatedPosition;

                rotatedPosition.x = pos.x * cosA - pos.y * sinA;
                rotatedPosition.y = pos.x * sinA + pos.y * cosA;
                rotatedPosition.z = pos.z; 

                vOriginalPosition = pos;

                vec4 viewPosition = uModelViewMatrix * vec4(rotatedPosition, 1.0);
                gl_Position = uProjectionMatrix * viewPosition;

                vViewPosition = viewPosition.xyz;

                float dist = length(viewPosition.xyz);
                gl_PointSize = uPointSize * (1.0 / dist);

                vValue = aValue;
                vPhase = aPhase;
                vViewPosition = viewPosition.xyz;
            }
        `;

        const pointFragmentShader = `#version 300 es
            precision highp float;

            in float vValue;
            in float vPhase;
            in vec3 vViewPosition;
            in vec3 vOriginalPosition; 

            uniform bool uComplexMode;
            uniform bool uCutAway;
            uniform float uTargetValue;
            uniform float uDelta;
            uniform vec3 uLightPosition;
            uniform int uColorMap;
            uniform bool uReverseColorMap;

            out vec4 fragColor;

            vec3 inferno(float t) {
                t = clamp(t, 0.0, 1.0);
                const vec3 c0 = vec3(0.0, 0.0, 0.0);
                const vec3 c1 = vec3(0.5, 0.0, 0.4);
                const vec3 c2 = vec3(1.0, 0.4, 0.0);
                const vec3 c3 = vec3(1.0, 1.0, 0.0);

                if (t < 0.33) {
                    return mix(c0, c1, t * 3.0);
                } else if (t < 0.66) {
                    return mix(c1, c2, (t - 0.33) * 3.0);
                } else {
                    return mix(c2, c3, (t - 0.66) * 3.0);
                }
            }

            vec3 viridis(float t) {
                t = clamp(t, 0.0, 1.0);
                const vec3 c0 = vec3(0.267, 0.004, 0.329);
                const vec3 c1 = vec3(0.127, 0.566, 0.550);
                const vec3 c2 = vec3(0.369, 0.788, 0.382);
                const vec3 c3 = vec3(0.993, 0.906, 0.144);

                if (t < 0.33) {
                    return mix(c0, c1, t * 3.0);
                } else if (t < 0.66) {
                    return mix(c1, c2, (t - 0.33) * 3.0);
                } else {
                    return mix(c2, c3, (t - 0.66) * 3.0);
                }
            }

            vec3 parula(float t) {
                t = clamp(t, 0.0, 1.0);
                const vec3 c0 = vec3(0.208, 0.165, 0.529);
                const vec3 c1 = vec3(0.137, 0.518, 0.832);
                const vec3 c2 = vec3(0.090, 0.745, 0.812);
                const vec3 c3 = vec3(0.702, 0.867, 0.180);
                const vec3 c4 = vec3(0.988, 0.702, 0.106);

                if (t < 0.25) {
                    return mix(c0, c1, t * 4.0);
                } else if (t < 0.5) {
                    return mix(c1, c2, (t - 0.25) * 4.0);
                } else if (t < 0.75) {
                    return mix(c2, c3, (t - 0.5) * 4.0);
                } else {
                    return mix(c3, c4, (t - 0.75) * 4.0);
                }
            }

            vec3 gray(float t) {
                t = clamp(t, 0.0, 1.0);
                return vec3(t);
            }

            vec3 coolwarm(float t) {
                t = clamp(t, 0.0, 1.0);
                float s = 2.0 * t - 1.0; 

                if (s < 0.0) {
                    return vec3(0.0, 0.0, 0.5 * (1.0 + s));
                } else {
                    return vec3(0.5 * (1.0 + s), 0.0, 0.0);
                }
            }

            vec3 turbo(float t) {
                t = clamp(t, 0.0, 1.0);
                const vec3 c0 = vec3(0.18995, 0.07176, 0.23217);
                const vec3 c1 = vec3(0.06748, 0.38195, 0.79287);
                const vec3 c2 = vec3(0.00000, 0.66093, 0.56590);
                const vec3 c3 = vec3(0.35749, 0.86890, 0.11561);
                const vec3 c4 = vec3(0.89267, 0.63571, 0.00000);
                const vec3 c5 = vec3(1.00000, 0.18739, 0.00000);

                float pos = t * 5.0;
                int idx = int(floor(pos));
                float frac = pos - float(idx);

                if (idx == 0) return mix(c0, c1, frac);
                if (idx == 1) return mix(c1, c2, frac);
                if (idx == 2) return mix(c2, c3, frac);
                if (idx == 3) return mix(c3, c4, frac);
                return mix(c4, c5, frac);
            }

            vec3 hsl(float t) {
                t = clamp(t, 0.0, 1.0);
                float h = t;
                float s = 1.0;
                float l = 0.5;

                float c = (1.0 - abs(2.0 * l - 1.0)) * s;
                float h2 = h * 6.0;
                float x = c * (1.0 - abs(mod(h2, 2.0) - 1.0));
                float m = l - c/2.0;

                vec3 rgb;

                if (h2 < 1.0) rgb = vec3(c, x, 0.0);
                else if (h2 < 2.0) rgb = vec3(x, c, 0.0);
                else if (h2 < 3.0) rgb = vec3(0.0, c, x);
                else if (h2 < 4.0) rgb = vec3(0.0, x, c);
                else if (h2 < 5.0) rgb = vec3(x, 0.0, c);
                else rgb = vec3(c, 0.0, x);

                return rgb + m;
            }

            vec3 twilight(float t) {
                t = clamp(t, 0.0, 1.0);
                const vec3 c0 = vec3(0.85, 0.10, 0.10);
                const vec3 c1 = vec3(0.65, 0.27, 0.45);
                const vec3 c2 = vec3(0.35, 0.45, 0.65);
                const vec3 c3 = vec3(0.25, 0.60, 0.85);
                const vec3 c4 = vec3(0.25, 0.60, 0.85);
                const vec3 c5 = vec3(0.35, 0.45, 0.65);
                const vec3 c6 = vec3(0.65, 0.27, 0.45);
                const vec3 c7 = vec3(0.85, 0.10, 0.10);

                float pos = t * 7.0;
                int idx = int(floor(pos));
                float frac = pos - float(idx);

                if (idx == 0) return mix(c0, c1, frac);
                if (idx == 1) return mix(c1, c2, frac);
                if (idx == 2) return mix(c2, c3, frac);
                if (idx == 3) return mix(c3, c4, frac);
                if (idx == 4) return mix(c4, c5, frac);
                if (idx == 5) return mix(c5, c6, frac);
                return mix(c6, c7, frac);
            }

            vec3 getColorFromMap(float t, int map) {

                if (uReverseColorMap) {
                    t = 1.0 - t;
                }

                if (map == 0) return inferno(t);
                if (map == 1) return viridis(t);
                if (map == 2) return parula(t);
                if (map == 3) return turbo(t);
                if (map == 4) return coolwarm(t);
                if (map == 5) return twilight(t);
                if (map == 6) return hsl(t);
                return gray(t);
            }

            void main() {

                vec2 ndc = 2.0 * gl_PointCoord - 1.0;

                float r2 = dot(ndc, ndc);

                if (r2 > 1.0) discard;

                float z = sqrt(1.0 - r2);
                vec3 normal = vec3(ndc, z);

                float diffuse = max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));

                float rim = 1.0 - diffuse;
                rim = pow(rim, 3.0) * 0.5;

                float specular = pow(diffuse, 16.0) * 0.5;

                float lighting = 0.4 + 0.3 * diffuse + rim + specular;
                lighting = min(1.0, lighting); 

                float alpha = 1.0;

                vec3 color;

                if (uComplexMode) {

                    vec3 phaseColor = getColorFromMap(vPhase, uColorMap);

                    float brightness = 0.2 + 0.8 * vValue;

                    color = phaseColor * brightness;
                } else if (uColorMap == 7) { 

                    color = getColorFromMap(vValue, uColorMap);
                } else {

                    vec3 baseColor = getColorFromMap(vValue, uColorMap);

                    float intensityBoost = pow(vValue, 0.85); 

                    color = mix(baseColor, baseColor * intensityBoost, 0.7);

                    color = max(color, vec3(0.15)); 
                }

                color *= lighting;

                fragColor = vec4(color, alpha);
            }
        `;

        const boxVertexShader = `#version 300 es
            precision highp float;

            in vec3 aPosition;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;

            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
            }
        `;

        const boxFragmentShader = `#version 300 es
            precision highp float;

            out vec4 fragColor;

            void main() {
                fragColor = vec4(0.5, 0.5, 0.5, 0.5);
            }
        `;

        this.pointProgram = this.createProgram(pointVertexShader, pointFragmentShader);
        this.boxProgram = this.createProgram(boxVertexShader, boxFragmentShader);
    }

    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;

        const vertexShader = this.compileShader(vsSource, gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fsSource, gl.FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        return program;
    }

    initBoxGeometry() {
        const gl = this.gl;

        const size = 10.0;
        const vertices = new Float32Array([
            -size, -size, -size,
            -size, -size, size,
            -size, size, -size,
            -size, size, size,
            size, -size, -size,
            size, -size, size,
            size, size, -size,
            size, size, size
        ]);

        const indices = new Uint16Array([
            0, 1, 0, 2, 1, 3, 2, 3,
            4, 5, 4, 6, 5, 7, 6, 7,
            0, 4, 1, 5, 2, 6, 3, 7
        ]);

        this.boxSize = size;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.boxIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    setBoxSize(size) {
        const gl = this.gl;

        const vertices = new Float32Array([
            -size, -size, -size,
            -size, -size, size,
            -size, size, -size,
            -size, size, size,
            size, -size, -size,
            size, -size, size,
            size, size, -size,
            size, size, size
        ]);

        this.boxSize = size;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    setPointCloud(points, values, count, boxSize, visualizationMode) {
        const gl = this.gl;

        if (!points || !values || count === 0) {
            console.error('OrbitalRenderer: Invalid point cloud data');
            return;
        }

        this.createOrbitalBuffer(points, values, null);

        this.pointCount = count;
        this.boxSize = boxSize;

        if (visualizationMode === 'complex') {
            this.setComplexMode();
        } else {
            this.clearComplexMode();
        }
    }

    createOrbitalBuffer(positions, values, phases) {
        const gl = this.gl;

        if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
        if (this.valueBuffer) gl.deleteBuffer(this.valueBuffer);
        if (this.phaseBuffer) gl.deleteBuffer(this.phaseBuffer);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.valueBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.valueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);

        if (phases) {
            this.phaseBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.phaseBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(phases), gl.STATIC_DRAW);
        }

        this.pointCount = positions.length / 3;

        const vaoExt = gl.getExtension('OES_vertex_array_object');
        if (vaoExt) {
            if (this.vao) vaoExt.deleteVertexArrayOES(this.vao);
            this.vao = vaoExt.createVertexArrayOES();
            vaoExt.bindVertexArrayOES(this.vao);

            const posLoc = gl.getAttribLocation(this.pointProgram, 'aPosition');
            const valueLoc = gl.getAttribLocation(this.pointProgram, 'aValue');
            const phaseLoc = gl.getAttribLocation(this.pointProgram, 'aPhase');

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.valueBuffer);
            gl.enableVertexAttribArray(valueLoc);
            gl.vertexAttribPointer(valueLoc, 1, gl.FLOAT, false, 0, 0);

            if (phases) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.phaseBuffer);
                gl.enableVertexAttribArray(phaseLoc);
                gl.vertexAttribPointer(phaseLoc, 1, gl.FLOAT, false, 0, 0);
            }

            vaoExt.bindVertexArrayOES(null);
            this.hasVAO = true;
        } else {
            this.hasVAO = false;
        }
    }

    setPhaseValues(phases) {
        const gl = this.gl;

        this.phaseArray = phases;
        this.complexMode = true;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.phaseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, phases, gl.STATIC_DRAW);
    }

    clearComplexMode() {
        this.complexMode = false;
    }

    setColorMap(mapName) {
        const mapIndex = {
            'inferno': 0,
            'viridis': 1,
            'parula': 2,
            'turbo': 3,
            'coolwarm': 4,
            'twilight': 5,
            'hsl': 6,
            'gray': 7
        };

        this.colorMap = mapIndex[mapName] !== undefined ? mapIndex[mapName] : 0;
    }

    render(camera, deltaTime = 16.67) {
        const gl = this.gl;

        gl.clearColor(this.backgroundColor, this.backgroundColor, this.backgroundColor, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.resize();

        camera.updateAspect(this.canvas.width, this.canvas.height);

        if (this.pointCount === 0) {
            return;
        }

        gl.useProgram(this.pointProgram);

        const projectionMatrixLoc = gl.getUniformLocation(this.pointProgram, 'uProjectionMatrix');
        const modelViewMatrixLoc = gl.getUniformLocation(this.pointProgram, 'uModelViewMatrix');
        const pointSizeLoc = gl.getUniformLocation(this.pointProgram, 'uPointSize');
        const lightPositionLoc = gl.getUniformLocation(this.pointProgram, 'uLightPosition');
        const targetValueLoc = gl.getUniformLocation(this.pointProgram, 'uTargetValue');
        const deltaLoc = gl.getUniformLocation(this.pointProgram, 'uDelta');
        const colorMapLoc = gl.getUniformLocation(this.pointProgram, 'uColorMap');
        const reverseColorMapLoc = gl.getUniformLocation(this.pointProgram, 'uReverseColorMap');
        const complexModeLoc = gl.getUniformLocation(this.pointProgram, 'uComplexMode');
        const rotationAngleLoc = gl.getUniformLocation(this.pointProgram, 'uRotationAngle');

        let rotationAngle = 0;
        if (camera.autoRotate && !camera.isDragging) {
            rotationAngle = camera._totalAngle || 0;
        }

        if (rotationAngleLoc) {
            gl.uniform1f(rotationAngleLoc, rotationAngle);
        }

        gl.uniformMatrix4fv(projectionMatrixLoc, false, camera.projectionMatrix);
        gl.uniformMatrix4fv(modelViewMatrixLoc, false, camera.viewMatrix);
        gl.uniform1f(pointSizeLoc, 150.0);
        gl.uniform3f(lightPositionLoc, 0, 0, 0);
        gl.uniform1f(targetValueLoc, 1.0);
        gl.uniform1f(deltaLoc, 1.0);
        gl.uniform1i(colorMapLoc, this.colorMap);
        gl.uniform1i(reverseColorMapLoc, this.reverseColorMap ? 1 : 0);
        gl.uniform1i(complexModeLoc, this.complexMode ? 1 : 0);

        const positionLoc = gl.getAttribLocation(this.pointProgram, 'aPosition');
        const valueLoc = gl.getAttribLocation(this.pointProgram, 'aValue');
        const phaseLoc = gl.getAttribLocation(this.pointProgram, 'aPhase');

        if (this.hasVAO) {
            const vaoExt = gl.getExtension('OES_vertex_array_object');
            if (vaoExt) {
                vaoExt.bindVertexArrayOES(this.vao);
            } else {

                this.bindAttributes(gl, positionLoc, valueLoc, phaseLoc);
            }
        } else {

            this.bindAttributes(gl, positionLoc, valueLoc, phaseLoc);
        }

        gl.drawArrays(gl.POINTS, 0, this.pointCount);

        if (this.hasVAO) {
            const vaoExt = gl.getExtension('OES_vertex_array_object');
            if (vaoExt) {
                vaoExt.bindVertexArrayOES(null);
            }
        } else {

            gl.disableVertexAttribArray(positionLoc);
            gl.disableVertexAttribArray(valueLoc);
            gl.disableVertexAttribArray(phaseLoc);
        }

        if (this.displayBox) {
            this.renderBox(camera);
        }
    }

    bindAttributes(gl, positionLoc, valueLoc, phaseLoc) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.valueBuffer);
        gl.enableVertexAttribArray(valueLoc);
        gl.vertexAttribPointer(valueLoc, 1, gl.FLOAT, false, 0, 0);

        if (this.complexMode && this.phaseBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.phaseBuffer);
            gl.enableVertexAttribArray(phaseLoc);
            gl.vertexAttribPointer(phaseLoc, 1, gl.FLOAT, false, 0, 0);
        } else {

            gl.bindBuffer(gl.ARRAY_BUFFER, this.valueBuffer);
            gl.enableVertexAttribArray(phaseLoc);
            gl.vertexAttribPointer(phaseLoc, 1, gl.FLOAT, false, 0, 0);
        }
    }

    renderBox(camera) {
        const gl = this.gl;

        gl.useProgram(this.boxProgram);

        const projectionMatrixLoc = gl.getUniformLocation(this.boxProgram, 'uProjectionMatrix');
        const modelViewMatrixLoc = gl.getUniformLocation(this.boxProgram, 'uModelViewMatrix');

        gl.uniformMatrix4fv(projectionMatrixLoc, false, camera.projectionMatrix);
        gl.uniformMatrix4fv(modelViewMatrixLoc, false, camera.viewMatrix);

        const positionLoc = gl.getAttribLocation(this.boxProgram, 'aPosition');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLoc);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.boxIndexBuffer);
        gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);

        gl.disableVertexAttribArray(positionLoc);
    }
}
