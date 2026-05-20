import * as THREE from 'three'

export class RenderMaterial {
	constructor() {
		const isMobile = window.innerWidth <= 768
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				positions: { value: null },
				pointSize: { value: isMobile ? 3.0 : 2.0 },
				opacity: { value: 0.0 },
			},
			vertexShader: this.getVertexShader(),
			fragmentShader: this.getFragmentShader(),
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		})
	}

	getVertexShader() {
		return /* glsl */ `
			uniform sampler2D positions;
			uniform float pointSize;
			
			attribute vec2 reference;
			
			void main() {
				vec3 pos = texture2D(positions, reference).xyz;
				
				vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
				gl_Position = projectionMatrix * mvPosition;
				
				gl_PointSize = pointSize * (300.0 / -mvPosition.z);
			}
		`
	}

	getFragmentShader() {
		return /* glsl */ `
			uniform float opacity;

			void main() {
				vec2 coords = gl_PointCoord - vec2(0.5);
				float distance = length(coords);
				
				if (distance > 0.5) discard;
			
				
				gl_FragColor = vec4(1.0, 1.0, 1.0, opacity);
			}
		`
	}

	getMaterial() {
		return this.material
	}

	get uniforms() {
		return this.material.uniforms
	}

	setBrightness(opacity) {
		this.material.uniforms.opacity.value = opacity
	}
}
