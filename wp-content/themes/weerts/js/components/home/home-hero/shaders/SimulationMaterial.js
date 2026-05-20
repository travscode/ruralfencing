import * as THREE from 'three'

export class SimulationMaterial {
	constructor(sphereTexture, sphereSize) {
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				positions: { value: sphereTexture },
				time: { value: 0 },
				flowSpeed: { value: 1.25 },
				sphereRadius: { value: parseFloat(sphereSize) },
				radiusProgress: { value: 0.0 },
				velocityDamping: { value: 1.0 },
				curlStrength: { value: 1.0 },
				particleSeperation: { value: 13.0 },

				// Enhanced mouse force field uniforms
				mousePosition: { value: new THREE.Vector3(0, 0, 0) },
				mouseVelocity: { value: new THREE.Vector3(0, 0, 0) },
				mouseForceStrength: { value: 10.0 },
				mouseInfluenceRadius: { value: 100.0 },
				returnSpeed: { value: 0.000001 },

				// NEW: Full noise mode uniform
				fullNoiseMode: { value: 0.0 }, // 0.0 = sphere constrained, 1.0 = full 3D noise
			},
			vertexShader: this.getVertexShader(),
			fragmentShader: this.getFragmentShader(),
			depthWrite: false,
			depthTest: false,
		})
	}

	getVertexShader() {
		return /*glsl*/ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `
	}

	getFragmentShader() {
		return /*glsl*/ `
            uniform sampler2D positions;
            uniform float time;
            uniform float flowSpeed;
            uniform float sphereRadius;
            uniform float radiusProgress;
            uniform float velocityDamping;
            uniform float curlStrength;
            uniform float fullNoiseMode;
            uniform float particleSeperation;
            
            uniform vec3 mousePosition;
            uniform vec3 mouseVelocity;
            uniform float mouseForceStrength;
            uniform float mouseInfluenceRadius;
            uniform float returnSpeed;
            
            varying vec2 vUv;
            
            // Simplex 3D Noise implementation
            vec3 mod289(vec3 x) {
                return x - floor(x * (1.0 / 289.0)) * 289.0;
            }
            
            vec4 mod289(vec4 x) {
                return x - floor(x * (1.0 / 289.0)) * 289.0;
            }
            
            vec4 permute(vec4 x) {
                return mod289(((x*34.0)+1.0)*x);
            }
            
            vec4 taylorInvSqrt(vec4 r) {
                return 1.79284291400159 - 0.85373472095314 * r;
            }
            
            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                
                // First corner
                vec3 i = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);
                
                // Other corners
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);
                
                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;
                
                // Permutations
                i = mod289(i);
                vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                
                // Gradients: 7x7 points over a square, mapped onto an octahedron
                float n_ = 0.142857142857; // 1.0/7.0
                vec3 ns = n_ * D.wyz - D.xzx;
                
                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);
                
                vec4 x = x_ * ns.x + ns.yyyy;
                vec4 y = y_ * ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                
                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);
                
                vec4 s0 = floor(b0) * 2.0 + 1.0;
                vec4 s1 = floor(b1) * 2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                
                vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
                
                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);
                
                // Normalize gradients
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;
                
                // Mix final noise value
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }
            
            // Vector noise for curl calculation
            vec3 snoiseVec3(vec3 x) {
                float s  = snoise(vec3(x));
                float s1 = snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2));
                float s2 = snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4));
                vec3 c = vec3(s, s1, s2);
                return c;
            }
            
            // Proper curl noise implementation
            vec3 curlNoise(vec3 p) {
                const float e = 0.1;
                vec3 dx = vec3(e, 0.0, 0.0);
                vec3 dy = vec3(0.0, e, 0.0);
                vec3 dz = vec3(0.0, 0.0, e);
                
                vec3 p_x0 = snoiseVec3(p - dx);
                vec3 p_x1 = snoiseVec3(p + dx);
                vec3 p_y0 = snoiseVec3(p - dy);
                vec3 p_y1 = snoiseVec3(p + dy);
                vec3 p_z0 = snoiseVec3(p - dz);
                vec3 p_z1 = snoiseVec3(p + dz);
                
                float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
                float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
                float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
                
                const float divisor = 1.0 / (2.0 * e);
                return normalize(vec3(x, y, z) * divisor);
            }
            
            void main() {
    vec2 uv = vUv;
    vec4 posData = texture2D(positions, uv);
    vec3 pos = posData.xyz;
    float life = posData.w;
    
    // Create a unique offset for each particle to sample noise from different locations
    float particleId = (uv.x * 17.0 + uv.y * 13.0) * 100.0;
    vec3 noiseOffset = vec3(
        sin(particleId * 1.234),
        cos(particleId * 2.345),
        sin(particleId * 3.456)
    ) * particleSeperation;
    
    // Get sphere normal for this position
    vec3 sphereNormal = normalize(pos);
    
    // Sample curl noise with particle-specific offset
    float frequency = 0.008;
    vec3 offsetPosition = pos + noiseOffset;
    vec3 curlVelocity = curlNoise(offsetPosition * frequency + time * 0.25);
    
    // Add layers with different offsets
    curlVelocity += curlNoise(offsetPosition * frequency * 2.0 + time * 0.15) * -0.85;
    curlVelocity += curlNoise(offsetPosition * frequency * 4.0 - time * 0.2) * 0.25;
    
    // MODIFIED: Blend between sphere-constrained and full 3D noise
    vec3 tangentVelocity = curlVelocity - dot(curlVelocity, sphereNormal) * sphereNormal;
    vec3 finalCurlVelocity = mix(tangentVelocity, curlVelocity, fullNoiseMode);
    finalCurlVelocity *= flowSpeed * curlStrength;
    
    // SEPARATION FORCE - Push particles away from nearby positions
    vec3 separation = vec3(0.0);
    float separationRadius = 0.15;
    float separationStrength = 0.05;
    
    // Check a grid of nearby UV coordinates
    for(float dx = -0.02; dx <= 0.02; dx += 0.02) {
        for(float dy = -0.02; dy <= 0.02; dy += 0.02) {
            if(abs(dx) < 0.001 && abs(dy) < 0.001) continue;
            
            vec2 neighborUV = uv + vec2(dx, dy);
            neighborUV = fract(neighborUV);
            
            vec3 neighborPos = texture2D(positions, neighborUV).xyz;
            vec3 diff = pos - neighborPos;
            float dist = length(diff);
            
            if(dist < separationRadius && dist > 0.001) {
                float force = (separationRadius - dist) / separationRadius;
                force = force * force;
                separation += normalize(diff) * force * separationStrength;
            }
        }
    }
    
    // Add random jitter to break up uniform movement
    vec3 jitter = vec3(
        sin(time * 3.0 + particleId * 1.0),
        cos(time * 2.0 + particleId * 2.0),
        sin(time * 4.0 + particleId * 3.0)
    ) * 0.01;
    
    // Add turbulent dispersion force
    vec3 dispersion = snoiseVec3(pos * 0.1 + vec3(time * 0.5)) * 0.02;
    
    // Combine all velocities
    vec3 totalVelocity = finalCurlVelocity + separation + jitter + dispersion;
    
// Mouse interaction
vec3 toMouse = pos - mousePosition;
        float mouseDist = length(toMouse);
        float mouseInfluence = 1.0 - smoothstep(0.0, mouseInfluenceRadius, mouseDist);

        if (mouseInfluence > 0.01) {
            vec3 dir = normalize(toMouse);

            // Slowly changing swirl axis
            vec3 swirlAxis = normalize(vec3(
                sin(time * 0.15),
                cos(time * 0.2),
                sin(time * 0.1)
            ));

            vec3 swirlDir = normalize(cross(dir, swirlAxis));

            // Blend radial + swirl (mostly swirl)
            vec3 forceDir = normalize(mix(dir, swirlDir, 0.8));

            float strength = smoothstep(0.0, 1.0, mouseInfluence);

            // Apply swirl force
            totalVelocity += forceDir * strength * mouseForceStrength * 0.5;
}
    
    // Update position
    vec3 newPos = pos + totalVelocity;
    
    // MODIFIED: Sphere constraint only applies when not in full noise mode
    if (fullNoiseMode < 1.0) {
        float newRadius = length(newPos);
        float targetRadius = sphereRadius * radiusProgress;
        float radiusVariation = 0.2;
        
        // Soft sphere constraint
        float radiusDiff = newRadius - targetRadius;
        if(abs(radiusDiff) > radiusVariation) {
            float correction = sign(radiusDiff) * (abs(radiusDiff) - radiusVariation) * 0.1;
            newPos *= (1.0 - correction / newRadius);
        }
        
        // Blend the constrained position with unconstrained based on fullNoiseMode
        newPos = mix(newPos, pos + totalVelocity, fullNoiseMode);
    }
    
    // Apply damping
    vec3 velocity = newPos - pos;
    velocity *= velocityDamping;
    pos = pos + velocity;
    
    gl_FragColor = vec4(pos, 1.0);
}
        `
	}

	updateTime(time) {
		this.material.uniforms.time.value = time
	}

	updateMouseData(mousePos, mouseVelocity, inactiveTime) {
		this.material.uniforms.mousePosition.value.copy(mousePos)
		this.material.uniforms.mouseVelocity.value.copy(mouseVelocity)
	}

	// NEW: Method to control full noise mode
	setFullNoiseMode(value) {
		this.material.uniforms.fullNoiseMode.value = Math.max(
			0.0,
			Math.min(1.0, value)
		)
	}

	setParticleSeperation(value) {
		this.material.uniforms.particleSeperation.value = value
	}

	getMaterial() {
		return this.material
	}
}
