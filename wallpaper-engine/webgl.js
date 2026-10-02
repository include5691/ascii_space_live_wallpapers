import {SAMPLES_PER_CELL} from '../frame.js';
import {ASCII_SHADER, sceneShader} from '../shader.js';
import earthUrl from '../textures/earth.png';
import pillarsUrl from '../textures/pillars.png';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform float u_flip;
out vec2 v_st;

void main() {
    v_st = vec2(a_position.x, a_position.y * u_flip) * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShader = (source, entry) => `#version 300 es
precision highp float;
precision highp int;
#define texture2D texture
${source}
in vec2 v_st;
out vec4 fragColor;

void main() {
    fragColor = ${entry}(v_st);
}
`;

const EARTH_UNIT = 1;
const GALAXY_UNIT = 2;
const PILLARS_UNIT = 3;

async function loadImage(url) {
    const blob = await (await fetch(url)).blob();
    return createImageBitmap(blob, {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
}

export class WebGLRenderer {
    constructor(canvas, frame) {
        this._canvas = canvas;
        this._frame = frame;
        this._gl = canvas.getContext('webgl2', {alpha: false, antialias: false, depth: false, preserveDrawingBuffer: false});
        if (!this._gl)
            throw new Error('WebGL 2 is not available');
        const gl = this._gl;
        this._programs = new Map();
        this._ascii = this._program(ASCII_SHADER, 'asciiPixel');
        this._galaxyBlank = false;

        this._vertexArray = gl.createVertexArray();
        gl.bindVertexArray(this._vertexArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }

    async load() {
        const [earth, pillars] = await Promise.all([loadImage(earthUrl), loadImage(pillarsUrl)]);
        this._earth = this._texture(earth.width, earth.height, earth, this._gl.REPEAT);
        this._pillars = this._texture(pillars.width, pillars.height, pillars, this._gl.CLAMP_TO_EDGE);
    }

    resize(width, height) {
        const gl = this._gl;
        this._canvas.width = width;
        this._canvas.height = height;
        const {columns, rows} = this._frame.layout(width, height);
        [this._sceneTexture, this._galaxyTexture].forEach(texture => texture && gl.deleteTexture(texture));
        if (this._framebuffer)
            gl.deleteFramebuffer(this._framebuffer);
        this._sceneSize = [columns * SAMPLES_PER_CELL, rows * SAMPLES_PER_CELL];
        this._sceneTexture = this._texture(...this._sceneSize, null, gl.CLAMP_TO_EDGE);
        this._framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._sceneTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this._galaxyTexture = this._texture(columns, rows, null, gl.CLAMP_TO_EDGE);
        this._galaxyBlank = false;
    }

    draw(now, pointer) {
        const gl = this._gl;
        const {sceneUniforms, asciiUniforms, particles, camera} = this._frame.step(now, pointer);
        const {key, features, slots} = this._frame.shaderVariant();
        if (!this._programs.has(key))
            this._programs.set(key, this._program(sceneShader(features, slots), 'renderPixel'));
        const scene = this._programs.get(key);

        if (particles && features.includes('GALAXY') && !(this._galaxyBlank && !particles.count)) {
            const {columns, rows} = this._frame.grid;
            gl.bindTexture(gl.TEXTURE_2D, this._galaxyTexture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, columns, rows, gl.RGBA, gl.UNSIGNED_BYTE,
                this._frame.galaxyPixels(particles, camera));
            this._galaxyBlank = !particles.count;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
        gl.viewport(0, 0, ...this._sceneSize);
        this._bind(EARTH_UNIT, this._earth);
        this._bind(GALAXY_UNIT, this._galaxyTexture);
        this._bind(PILLARS_UNIT, this._pillars);
        this._run(scene, [
            ...sceneUniforms,
            ['u_flip', 1, [1]],
        ], {earth_map: EARTH_UNIT, galaxy_map: GALAXY_UNIT, pillar_map: PILLARS_UNIT});

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this._canvas.width, this._canvas.height);
        this._bind(0, this._sceneTexture);
        this._run(this._ascii, [...asciiUniforms, ['u_flip', 1, [-1]]], {scene: 0});
    }

    _run({program, locations}, uniforms, samplers) {
        const gl = this._gl;
        gl.useProgram(program);
        const location = name => {
            if (!locations.has(name))
                locations.set(name, gl.getUniformLocation(program, name));
            return locations.get(name);
        };
        for (const [name, unit] of Object.entries(samplers))
            gl.uniform1i(location(name), unit);
        for (const [name, components, values] of uniforms)
            gl[`uniform${components}fv`](location(name), values);
        gl.bindVertexArray(this._vertexArray);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    _bind(unit, texture) {
        const gl = this._gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    _texture(width, height, source, wrap) {
        const gl = this._gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (source)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
        else
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
        return texture;
    }

    _program(source, entry) {
        const gl = this._gl;
        const program = gl.createProgram();
        for (const [type, code] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, fragmentShader(source, entry)]]) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, code);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                throw new Error(`${entry} shader: ${gl.getShaderInfoLog(shader)}`);
            gl.attachShader(program, shader);
        }
        gl.bindAttribLocation(program, 0, 'a_position');
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error(`${entry} program: ${gl.getProgramInfoLog(program)}`);
        return {program, locations: new Map()};
    }
}
