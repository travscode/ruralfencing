import * as THREE from 'three'

class VideoMaterial extends THREE.ShaderMaterial {
	constructor(
		videoTexture,
		circleCenter = new THREE.Vector2(0.5, 0.5),
		circleRadius = 0.3,
		smoothness = 0.05
	) {
		super()
		this.uniforms = {
			videoTexture: { value: videoTexture },
			circleCenter: { value: circleCenter },
			circleRadius: { value: circleRadius },
			smoothness: { value: smoothness },
		}

		this.vertexShader = this.getVertexShader()
		this.fragmentShader = this.getFragmentShader()

		// Enable transparency for masking effect
		this.transparent = false
		this.alphaTest = 0.001
	}

	getVertexShader = () => {
		return /* glsl */ `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `
	}

	getFragmentShader = () => {
		return /* glsl */ `
        uniform sampler2D videoTexture;
        uniform vec2 circleCenter;
        uniform float circleRadius;
        uniform float smoothness;
        varying vec2 vUv;

        void main() {
            // Always sample the full video texture at current UV
            vec4 videoColor = texture2D(videoTexture, vUv);
            
            // Distance from circle center in UV space
            float dist = distance(vUv, circleCenter);
            
            // Create circular mask - only affects alpha/visibility
            float mask = 1.0 - smoothstep(circleRadius - smoothness, circleRadius + smoothness, dist);
            
            // Video shows through where mask allows it
            gl_FragColor = vec4(videoColor.rgb, mask);
        }
        `
	}

	// Helper methods to update uniforms
	setCircleCenter(center) {
		this.uniforms.circleCenter.value = center
	}

	setCircleRadius(radius) {
		this.uniforms.circleRadius.value = radius
	}

	setSmoothness(smoothness) {
		this.uniforms.smoothness.value = smoothness
	}
}

export default VideoMaterial
