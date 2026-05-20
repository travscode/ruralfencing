import * as THREE from 'three'
// Helper function to convert hex to normalized RGB
function hexToNormalizedRGB(hex) {
	hex = hex.replace('#', '')
	return [
		parseInt(hex.slice(0, 2), 16) / 255,
		parseInt(hex.slice(2, 4), 16) / 255,
		parseInt(hex.slice(4, 6), 16) / 255,
	]
}

// Vertex shader
const vertexShader = /* glsl */ `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `

// Fragment shader
const fragmentShader = /* glsl */ `
            varying vec2 vUv;
            varying vec3 vPosition;
            uniform float uTime;
            uniform vec3  uColor;
            uniform float uSpeed;
            uniform float uScale;
            uniform float uRotation;
            uniform float uNoiseIntensity;
            
            const float e = 2.71828182845904523536;
            
            float noise(vec2 texCoord) {
                float G = e;
                vec2  r = (G * sin(G * texCoord));
                return fract(r.x * r.y * (1.0 + texCoord.x));
            }
            
            vec2 rotateUvs(vec2 uv, float angle) {
                float c = cos(angle);
                float s = sin(angle);
                mat2  rot = mat2(c, -s, s, c);
                return rot * uv;
            }
            
            void main() {
                float rnd        = noise(gl_FragCoord.xy);
                vec2  uv         = rotateUvs(vUv * uScale, uRotation);
                vec2  tex        = uv * uScale;
                float tOffset    = uSpeed * uTime;
                tex.y += 0.03 * sin(8.0 * tex.x - tOffset);
                float pattern = 0.6 +
                              0.4 * sin(5.0 * (tex.x + tex.y +
                                               cos(3.0 * tex.x + 5.0 * tex.y) +
                                               0.02 * tOffset) +
                                       sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
                vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
                col.a = 1.0;
                gl_FragColor = col;
            }
        `

// Main Silk class
class Silk {
	constructor(container, props = {}) {
		// Default props
		this.props = {
			speed: props.speed || 5,
			scale: props.scale || 1,
			color: props.color || '#7B7481',
			noiseIntensity: props.noiseIntensity || 1.5,
			rotation: props.rotation || 0,
		}

		this.container = container
		this.init()
	}

	init() {
		// Scene setup
		this.scene = new THREE.Scene()

		// Camera setup - orthographic for full viewport coverage
		const aspect = this.container.clientWidth / this.container.clientHeight
		this.camera = new THREE.OrthographicCamera(
			-aspect / 2,
			aspect / 2,
			0.5,
			-0.5,
			0.1,
			10
		)
		this.camera.position.z = 1

		// Renderer setup
		this.renderer = new THREE.WebGLRenderer({ antialias: true })
		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight
		)
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		this.container.appendChild(this.renderer.domElement)

		// Create uniforms
		this.uniforms = {
			uSpeed: { value: this.props.speed },
			uScale: { value: this.props.scale },
			uNoiseIntensity: { value: this.props.noiseIntensity },
			uColor: {
				value: new THREE.Color(...hexToNormalizedRGB(this.props.color)),
			},
			uRotation: { value: this.props.rotation },
			uTime: { value: 0 },
		}

		// Create shader material
		this.material = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
		})

		// Create geometry
		this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1)

		// Create mesh
		this.mesh = new THREE.Mesh(this.geometry, this.material)
		this.scene.add(this.mesh)

		// Update mesh scale to match viewport
		this.updateMeshScale()

		// Handle resize
		window.addEventListener('resize', () => this.onResize())

		// Start animation
		this.animate()
	}

	updateMeshScale() {
		// Calculate viewport dimensions in world units
		const aspect = this.container.clientWidth / this.container.clientHeight
		const viewHeight = 1 // Height of orthographic camera view
		const viewWidth = viewHeight * aspect

		// Scale mesh to fill viewport
		this.mesh.scale.set(viewWidth, viewHeight, 1)
	}

	onResize() {
		const aspect = this.container.clientWidth / this.container.clientHeight

		// Update camera
		this.camera.left = -aspect / 2
		this.camera.right = aspect / 2
		this.camera.updateProjectionMatrix()

		// Update renderer
		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight
		)

		// Update mesh scale
		this.updateMeshScale()
	}

	animate() {
		requestAnimationFrame(() => this.animate())

		// Update time uniform
		this.uniforms.uTime.value += 0.1 * 0.016 // Assuming 60fps, delta ≈ 0.016

		this.renderer.render(this.scene, this.camera)
	}

	// Method to update props dynamically
	updateProps(newProps) {
		Object.assign(this.props, newProps)

		// Update uniforms
		if (newProps.speed !== undefined) {
			this.uniforms.uSpeed.value = newProps.speed
		}
		if (newProps.scale !== undefined) {
			this.uniforms.uScale.value = newProps.scale
		}
		if (newProps.noiseIntensity !== undefined) {
			this.uniforms.uNoiseIntensity.value = newProps.noiseIntensity
		}
		if (newProps.color !== undefined) {
			this.uniforms.uColor.value = new THREE.Color(
				...hexToNormalizedRGB(newProps.color)
			)
		}
		if (newProps.rotation !== undefined) {
			this.uniforms.uRotation.value = newProps.rotation
		}
	}

	dispose() {
		this.geometry.dispose()
		this.material.dispose()
		this.renderer.dispose()
		window.removeEventListener('resize', () => this.onResize())
	}
}

// Initialize when DOM is loaded
export default function initRibbons() {
	const container = document.getElementById('ribbon-container')

	if (!container) return

	// Create silk effect with custom props
	const silk = new Silk(container, {
		speed: 5,
		scale: 0.85,
		color: '#7c7c7c',
		noiseIntensity: 2.0,
		rotation: 0,
	})
}
