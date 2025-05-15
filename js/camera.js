class Camera {
    constructor(canvas) {
        this.canvas = canvas;

        this.position = vec3.fromValues(0, 0, 20);
        this.target = vec3.fromValues(0, 0, 0);
        this.up = vec3.fromValues(0, 1, 0);

        this.viewMatrix = mat4.create();
        this.updateViewMatrix();

        this.fov = 45 * Math.PI / 180;
        this.near = 0.1;
        this.far = 1000;
        this.aspect = this.canvas.width / this.canvas.height;

        this.projectionMatrix = mat4.create();
        this.updateProjectionMatrix();

        this.rotationSpeed = 0.005;
        this.panSpeed = 0.01;
        this.zoomSpeed = 0.1;
        this.autoRotate = true;
        this.autoRotateSpeed = 0.001;

        this.isDragging = false;
        this.isRightDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.radius = vec3.length(this.position);
        this.phi = Math.atan2(this.position[2], this.position[0]);
        this.theta = Math.acos(this.position[1] / this.radius);

        this._bindEvents();
    }

    updateViewMatrix() {

        const out = this.viewMatrix;

        const zx = this.position[0] - this.target[0];
        const zy = this.position[1] - this.target[1];
        const zz = this.position[2] - this.target[2];

        let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
        if (len === 0) len = 0.000001;
        const zNormX = zx / len;
        const zNormY = zy / len;
        const zNormZ = zz / len;

        const upX = this.up[0];
        const upY = this.up[1];
        const upZ = this.up[2];

        const xNormX = upY * zNormZ - upZ * zNormY;
        const xNormY = upZ * zNormX - upX * zNormZ;
        const xNormZ = upX * zNormY - upY * zNormX;

        len = Math.sqrt(xNormX * xNormX + xNormY * xNormY + xNormZ * xNormZ);
        if (len === 0) len = 0.000001;
        const xFinalX = xNormX / len;
        const xFinalY = xNormY / len;
        const xFinalZ = xNormZ / len;

        const yFinalX = zNormY * xFinalZ - zNormZ * xFinalY;
        const yFinalY = zNormZ * xFinalX - zNormX * xFinalZ;
        const yFinalZ = zNormX * xFinalY - zNormY * xFinalX;

        out[0] = xFinalX;
        out[1] = yFinalX;
        out[2] = zNormX;
        out[3] = 0;
        out[4] = xFinalY;
        out[5] = yFinalY;
        out[6] = zNormY;
        out[7] = 0;
        out[8] = xFinalZ;
        out[9] = yFinalZ;
        out[10] = zNormZ;
        out[11] = 0;

        out[12] = -(xFinalX * this.position[0] + xFinalY * this.position[1] + xFinalZ * this.position[2]);
        out[13] = -(yFinalX * this.position[0] + yFinalY * this.position[1] + yFinalZ * this.position[2]);
        out[14] = -(zNormX * this.position[0] + zNormY * this.position[1] + zNormZ * this.position[2]);
        out[15] = 1;

        return this.viewMatrix;
    }

    updateProjectionMatrix() {

        const out = this.projectionMatrix;
        const f = 1.0 / Math.tan(this.fov / 2);
        const nf = 1 / (this.near - this.far);

        out[0] = f / this.aspect;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = f;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = (this.far + this.near) * nf;
        out[11] = -1;
        out[12] = 0;
        out[13] = 0;
        out[14] = (2 * this.far * this.near) * nf;
        out[15] = 0;

        return this.projectionMatrix;
    }

    updateAspect(width, height) {
        this.aspect = width / height;
        this.updateProjectionMatrix();
    }

    reset() {
        this.position = vec3.fromValues(0, 0, 20);
        this.target = vec3.fromValues(0, 0, 0);
        this.radius = vec3.length(this.position);
        this.phi = Math.atan2(this.position[2], this.position[0]);
        this.theta = Math.acos(this.position[1] / this.radius);
        this.updateViewMatrix();
    }

    updatePositionFromSpherical() {
        this.position[0] = this.radius * Math.sin(this.theta) * Math.cos(this.phi);
        this.position[1] = this.radius * Math.cos(this.theta);
        this.position[2] = this.radius * Math.sin(this.theta) * Math.sin(this.phi);
        this.updateViewMatrix();
    }

    orbit(deltaX, deltaY) {
        this.phi -= deltaX * this.rotationSpeed;
        this.theta = Math.max(0.1, Math.min(Math.PI - 0.1, this.theta + deltaY * this.rotationSpeed));
        this.updatePositionFromSpherical();
    }

    pan(deltaX, deltaY) {

        const forward = vec3.create();
        vec3.subtract(forward, this.target, this.position);
        vec3.normalize(forward, forward);

        const right = vec3.create();
        vec3.cross(right, forward, this.up);
        vec3.normalize(right, right);

        const up = vec3.create();
        vec3.cross(up, right, forward);
        vec3.normalize(up, up);

        const distance = vec3.length(vec3.subtract(vec3.create(), this.target, this.position));
        const moveFactor = distance * this.panSpeed;

        const moveRight = vec3.scale(vec3.create(), right, -deltaX * moveFactor);
        const moveUp = vec3.scale(vec3.create(), up, deltaY * moveFactor);

        vec3.add(this.target, this.target, moveRight);
        vec3.add(this.target, this.target, moveUp);

        vec3.add(this.position, this.position, moveRight);
        vec3.add(this.position, this.position, moveUp);

        this.updateViewMatrix();
    }

    zoom(delta) {
        this.radius = Math.max(1, this.radius - delta * this.zoomSpeed);
        this.updatePositionFromSpherical();
    }

    getRotationMatrix(deltaTime) {

        const rotationMatrix = mat4.create();

        if (this.autoRotate && !this.isDragging) {

            if (!this._totalAngle) this._totalAngle = 0;

            const scaledDelta = Math.min(deltaTime, 33) / 1000;
            const angle = this.autoRotateSpeed * scaledDelta * 0.5;
            this._totalAngle += angle;

            const c = Math.cos(this._totalAngle);
            const s = Math.sin(this._totalAngle);

            rotationMatrix[0] = c;
            rotationMatrix[2] = -s;
            rotationMatrix[8] = s;
            rotationMatrix[10] = c;
        }

        return rotationMatrix;
    }

    update(deltaTime) {

    }

    _bindEvents() {
        this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
        document.addEventListener('mouseup', this._onMouseUp.bind(this));
        document.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.canvas.addEventListener('wheel', this._onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', this._onContextMenu.bind(this));

        this.canvas.addEventListener('touchstart', this._onTouchStart.bind(this));
        document.addEventListener('touchend', this._onTouchEnd.bind(this));
        document.addEventListener('touchmove', this._onTouchMove.bind(this));
    }

    _onMouseDown(event) {
        event.preventDefault();

        if (event.button === 0) {
            this.isDragging = true;
        } else if (event.button === 2) {
            this.isRightDragging = true;
        }

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    _onMouseUp(event) {
        if (event.button === 0) {
            this.isDragging = false;
        } else if (event.button === 2) {
            this.isRightDragging = false;
        }
    }

    _onMouseMove(event) {
        if (!this.isDragging && !this.isRightDragging) return;

        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;

        if (this.isDragging) {
            this.orbit(deltaX, deltaY);
        } else if (this.isRightDragging) {
            this.pan(deltaX, deltaY);
        }

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    _onWheel(event) {
        event.preventDefault();
        this.zoom(Math.sign(event.deltaY));
    }

    _onContextMenu(event) {
        event.preventDefault();
    }

    _onTouchStart(event) {
        event.preventDefault();

        if (event.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = event.touches[0].clientX;
            this.lastMouseY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {

            this.isDragging = false;
            this.isZooming = true;
            this.lastPinchDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
        } else if (event.touches.length === 3) {

            this.isDragging = false;
            this.isZooming = false;
            this.isRightDragging = true;
            this.lastMouseX = event.touches[0].clientX;
            this.lastMouseY = event.touches[0].clientY;
        }
    }

    _onTouchEnd(event) {
        this.isDragging = false;
        this.isZooming = false;
        this.isRightDragging = false;
    }

    _onTouchMove(event) {
        event.preventDefault();

        if (this.isDragging && event.touches.length === 1) {
            const deltaX = event.touches[0].clientX - this.lastMouseX;
            const deltaY = event.touches[0].clientY - this.lastMouseY;

            this.orbit(deltaX, deltaY);

            this.lastMouseX = event.touches[0].clientX;
            this.lastMouseY = event.touches[0].clientY;
        } else if (this.isZooming && event.touches.length === 2) {

            const pinchDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );

            const pinchDelta = pinchDistance - this.lastPinchDistance;
            this.zoom(-pinchDelta * 0.01);

            this.lastPinchDistance = pinchDistance;
        } else if (this.isRightDragging && event.touches.length === 3) {
            const deltaX = event.touches[0].clientX - this.lastMouseX;
            const deltaY = event.touches[0].clientY - this.lastMouseY;

            this.pan(deltaX, deltaY);

            this.lastMouseX = event.touches[0].clientX;
            this.lastMouseY = event.touches[0].clientY;
        }
    }
}
