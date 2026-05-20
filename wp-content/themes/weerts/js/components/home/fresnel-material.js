import * as THREE from 'three'

class WhiteFresnelMaterial extends THREE.ShaderMaterial {
	constructor() {
		super()
		this.uniforms = {
			fresnelColor: { value: new THREE.Color(0x222222) },
			solidColor: { value: new THREE.Color(0x000000) },
			fresnelPower: { value: 4.0 },
			fresnelOpacity: { value: 1.0 },
			time: { value: 0.0 },
			noiseScale: { value: 1.0 },
			noiseStrength: { value: 0.15 },
			noiseSpeed: { value: 1.0 },
		}

		this.vertexShader = this.getVertexShader()
		this.fragmentShader = this.getFragmentShader()

		this.transparent = false
		this.side = THREE.BackSide
	}

	// Call this in your animation loop to animate the noise
	updateTime(time) {
		this.uniforms.time.value = time
	}

	getVertexShader = () => {
		return /*glsl */ `
			varying vec3 vNormal;
			varying vec3 vViewPosition;
			varying vec3 vWorldPosition;

			void main() {
				// Transform normal to world space
				vNormal = normalize(normalMatrix * normal);
				
				// Get world position
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				vWorldPosition = worldPosition.xyz;
				
				// Get view position (camera space)
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				vViewPosition = -mvPosition.xyz;
				
				// Standard vertex transformation
				gl_Position = projectionMatrix * mvPosition;
			}
		`
	}

	getFragmentShader = () => {
		return /*glsl */ `
			uniform vec3 fresnelColor;
            uniform vec3 solidColor;
			uniform float fresnelPower;
			uniform float fresnelOpacity;
			
			varying vec3 vNormal;
			varying vec3 vViewPosition;
			varying vec3 vWorldPosition;

			void main() {
				// Calculate view direction (from surface to camera)
				vec3 viewDirection = normalize(vViewPosition);
				
				// Calculate base fresnel factor
				float fresnel = dot(normalize(vNormal), viewDirection);
				fresnel = 1.0 - abs(fresnel);
				
				fresnel = clamp(fresnel, 0.0, 1.0);
				
				// Apply power for rim lighting effect
				fresnel = pow(fresnel, fresnelPower);
				
				vec3 color = solidColor + (fresnelColor * fresnel);
				
				gl_FragColor = vec4(color, 1.0);
			}
		`
	}
}

export default WhiteFresnelMaterial
