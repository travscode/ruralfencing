import * as THREE from 'three'

export class SimulationMaterial {
	constructor(sphereTexture, sphereSize) {
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				positions: { value: sphereTexture },
				time: { value: 0 },
				timeController: { value: 1.0 },
				curlSize: { value: 0.0125 },
				curlStrength: { value: 0.75 },
				flowSpeed: { value: 0.9 },
				sphereRadius: { value: parseFloat(sphereSize) },
				radiusVariation: { value: 0.01 },
				divergence: { value: 0.03 },
				turbulence: { value: 0.05 },
				swarmCohesion: { value: 0.01 },

				// Enhanced mouse force field uniforms
				mousePosition: { value: new THREE.Vector3(0, 0, 0) },
				mouseVelocity: { value: new THREE.Vector3(0, 0, 0) },
				mouseInactiveTime: { value: 0.0 },
				mouseForceStrength: { value: 4.0 }, // Increased from 4.0
				mouseInfluenceRadius: { value: 100.0 }, // Increased from 100.0
				mouseRepulsion: { value: 6.0 }, // Increased from 5.0
				velocityBoost: { value: 1.5 }, // Increased from 0.8
				returnSpeed: { value: 0.0005 }, // Reduced from 0.0002 for slower return
				trailLength: { value: 2.5 }, // New: controls how long the trail effect lasts
				distortionAmount: { value: 2.0 }, // New: controls the amount of distortion
				previousMousePositions: {
					value: [
						// New: store previous mouse positions for trail effect
						new THREE.Vector3(0, 0, 0),
						new THREE.Vector3(0, 0, 0),
						new THREE.Vector3(0, 0, 0),
						new THREE.Vector3(0, 0, 0),
						new THREE.Vector3(0, 0, 0),
					],
				},
				trailWeights: { value: [1.0, 0.8, 0.6, 0.4, 0.2] }, // New: weights for trail effect
			},
			vertexShader: this.getVertexShader(),
			fragmentShader: this.getFragmentShader(),
		})

		// Initialize trail history
		this.positionHistory = []
		for (let i = 0; i < 5; i++) {
			this.positionHistory.push(new THREE.Vector3(0, 0, 0))
		}
	}

	getVertexShader() {
		return `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `
	}

	getFragmentShader() {
		return `
            uniform sampler2D positions;
            uniform float time;
            uniform float timeController;
            uniform float curlSize;
            uniform float curlStrength;
            uniform float flowSpeed;
            uniform float sphereRadius;
            uniform float radiusVariation;
            uniform float divergence;
            uniform float turbulence;
            uniform float swarmCohesion;
            
            // Enhanced mouse force uniforms
            uniform vec3 mousePosition;
            uniform vec3 mouseVelocity;
            uniform float mouseInactiveTime;
            uniform float mouseForceStrength;
            uniform float mouseInfluenceRadius;
            uniform float mouseRepulsion;
            uniform float velocityBoost;
            uniform float returnSpeed;
            uniform float trailLength;
            uniform float distortionAmount;
            uniform vec3 previousMousePositions[5];
            uniform float trailWeights[5];
            
            varying vec2 vUv;
            
            ${this.getCurlNoiseCode()}
            
            // New function to calculate force from a specific position
            vec3 calculateForceFromPosition(vec3 originalPos, vec3 forcePosition, float forceMagnitude, float influenceRadius, float weight) {
                vec3 force = vec3(0.0);
                vec3 toPosition = forcePosition - originalPos;
                float distance = length(toPosition);
                
                if (distance > 0.1 && distance < influenceRadius) {
                    float normalizedDistance = distance / influenceRadius;
                    // Sharper falloff curve for more concentrated effect
                    float falloff = 1.0 - smoothstep(0.0, 1.0, normalizedDistance);
                    falloff = falloff * falloff * falloff; // Cubic for even sharper edge
                    
                    vec3 direction = normalize(originalPos - forcePosition);
                    force = direction * forceMagnitude * falloff * weight;
                    
                    // Add more lateral force based on velocity direction
                    vec3 velocityDirection = normalize(mouseVelocity);
                    if (length(mouseVelocity) > 0.5) {
                        float velocityAlignment = max(0.0, dot(direction, velocityDirection));
                        force += velocityDirection * forceMagnitude * falloff * weight * velocityAlignment * 2.0;
                        
                        // Add perpendicular force component for more swirling effect
                        vec3 perpDirection = normalize(cross(velocityDirection, vec3(0.0, 1.0, 0.0)));
                        force += perpDirection * forceMagnitude * falloff * weight * 0.7;
                    }
                }
                
                return force;
            }
            
            void main() {
                float timeAdjusted = time * timeController;

                vec3 originalPos = texture2D(positions, vUv).rgb;
                
                // Particle-specific noise offsets for natural variation
                vec3 positionHash = fract(originalPos * 43758.5453123);
                float particleId = positionHash.x + positionHash.y * 0.001 + positionHash.z * 0.001;
                
                // Time and spatial offsets per particle
                float timeOffset = particleId * 3.14;
                vec3 spatialOffset = vec3(
                    sin(particleId * 12.9898),
                    cos(particleId * 78.233),
                    sin(particleId * 37.719)
                ) * 0.01;





                
                // Natural curl noise flow with per-particle variation
                vec3 noise1 = curlNoise(originalPos * curlSize + timeAdjusted * flowSpeed + timeOffset * 0.1 + spatialOffset * 0.05) * curlStrength;
                vec3 noise2 = curlNoise(originalPos * curlSize * 2.5 + timeAdjusted * flowSpeed * 0.8 + timeOffset * 0.08 + vec3(50.0, 25.0, 37.0)) * curlStrength * 0.4;
                vec3 noise3 = curlNoise(originalPos * curlSize * 0.7 + timeAdjusted * flowSpeed * 1.2 + timeOffset * 0.12 + vec3(-40.0, 60.0, -30.0)) * curlStrength * 4.2;
                
                vec3 naturalFlow = noise1 + noise2 + noise3;
                
                // ENHANCED MOUSE FORCE WITH TRAIL
                vec3 mouseForce = vec3(0.0);


                
                // Mouse activity with smoother decay
                float activityDecay = exp(-mouseInactiveTime * 1.5); // Slower decay for lingering effect
                float velocityMagnitude = length(mouseVelocity);
                float mouseActivity = max(activityDecay, min(1.0, velocityMagnitude * velocityBoost));
                
                // Calculate forces from current and previous mouse positions
                if (mouseActivity > 0.01) {
                    // Current position force
                    mouseForce += calculateForceFromPosition(
                        originalPos,
                        mousePosition,
                        mouseForceStrength * mouseRepulsion,
                        mouseInfluenceRadius,
                        1.0
                    );






                    
                    // Add trail effect from previous positions
                    for (int i = 0; i < 5; i++) {
                        mouseForce += calculateForceFromPosition(
                            originalPos,
                            previousMousePositions[i],
                            mouseForceStrength * mouseRepulsion * 0.8, // Slightly weaker than current position
                            mouseInfluenceRadius * 0.9,               // Slightly smaller influence
                            trailWeights[i] * trailLength            // Use weights affected by trail length
                        );
                    }
                }
                
                // Apply forces with dynamic blending based on mouse activity
                vec3 totalForce = naturalFlow;
                
                // Calculate distance-based influence factor
                float distanceToMouse = length(mousePosition - originalPos);
                float distanceInfluence = smoothstep(mouseInfluenceRadius * 1.2, 0.0, distanceToMouse);
                
                // When mouse is active, reduce natural flow and add mouse force with dynamic weighting
                float mouseInfluenceBlend = mouseActivity * distanceInfluence;
                totalForce = mix(naturalFlow, mouseForce + naturalFlow * 0.2, mouseInfluenceBlend);
                
                // Add more dynamic distortion when mouse velocity is high
                if (velocityMagnitude > 1.0 && distanceInfluence > 0.1) {
                    vec3 velocityDir = normalize(mouseVelocity);
                    vec3 distortionAxis = cross(velocityDir, vec3(0.0, 1.0, 0.0));
                    float distortionStrength = velocityMagnitude * mouseActivity * distanceInfluence * distortionAmount;
                    
                    // Create stretching effect in direction of mouse movement
                    totalForce += velocityDir * distortionStrength * 0.5;
                    
                    // Create twisting effect perpendicular to mouse movement
                    totalForce += distortionAxis * distortionStrength * 0.3;
                }
                
                // Simple divergent flow with subtle variation
                float divergentPhase = sin(timeAdjusted * 0.5 + particleId * 0.1) * 0.5 + 0.5;
                vec3 divergentFlow = normalize(originalPos) * divergence * (divergentPhase - 0.5) * 2.0;
                
                // Simple swirl with slight variation
                vec3 swirl = cross(originalPos, vec3(0.0, 1.0, 0.0)) * 0.05 * sin(timeAdjusted * 0.3 + particleId * 0.2);
                
                vec3 displacement = totalForce + divergentFlow + swirl;
                vec3 newPos = originalPos + displacement;
                
                // Adaptive sphere cohesion with mouse influence
                float currentRadius = length(newPos);
                float targetRadius = sphereRadius + sin(timeAdjusted * 0.2 + dot(originalPos, vec3(1.0, 1.2, 0.8))) * radiusVariation;
                
                // IMPROVED: Adaptive cohesion strength based on mouse activity and distance
                float mouseDisturbanceLevel = mouseActivity * distanceInfluence;
                
                // Gradually reduce cohesion near active mouse for more dramatic distortion
                float effectiveCohesion = mix(
                    swarmCohesion,                         // Normal cohesion
                    swarmCohesion * 0.1,                   // Heavily reduced cohesion
                    mouseDisturbanceLevel * 0.9            // Blend factor based on mouse influence
                );
                
                // Gradually increase return speed when mouse is inactive
                float adaptiveReturnSpeed = mix(
                    returnSpeed * 0.2,                     // Slow return when active (distortion lingers)
                    returnSpeed * 2.0,                     // Faster return when inactive (gradually reform sphere)
                    1.0 - mouseActivity                    // Inverse of mouse activity
                );
                
                // Apply adaptive sphere cohesion
                if (currentRadius > 0.001) {
                    float radiusRatio = targetRadius / currentRadius;
                    
                    // More gradual return to sphere based on adaptive return speed
                    newPos = mix(newPos, newPos * radiusRatio, effectiveCohesion + adaptiveReturnSpeed);
                    
                    // Flexible boundaries when mouse is active
                    float boundaryFlex = 1.0 + mouseDisturbanceLevel * 10.0; // Allow much more stretching
                    float maxRadius = targetRadius * (1.3 * boundaryFlex);
                    float minRadius = targetRadius * (0.7 / boundaryFlex);
                    
                    // Softer boundary enforcement for smoother transitions
                    if (currentRadius > maxRadius) {
                        // Soft limit with exponential falloff
                        float excess = (currentRadius - maxRadius) / maxRadius;
                        float pullFactor = 1.0 - exp(-excess * 2.0);
                        newPos = mix(newPos, normalize(newPos) * maxRadius, pullFactor);
                    } else if (currentRadius < minRadius) {
                        // Soft minimum with exponential falloff
                        float deficit = (minRadius - currentRadius) / minRadius;
                        float pushFactor = 1.0 - exp(-deficit * 2.0);
                        newPos = mix(newPos, normalize(newPos) * minRadius, pushFactor);
                    }
                }
                
                // Very subtle temporal variation
                vec3 timeVariation = vec3(
                    sin(timeAdjusted * 1.1 + originalPos.x * 3.0 + particleId),
                    cos(timeAdjusted * 1.3 + originalPos.y * 3.0 + particleId * 1.1),
                    sin(timeAdjusted * 0.9 + originalPos.z * 3.0 + particleId * 0.9)
                ) * 0.015;
                
                newPos += timeVariation;
                
                gl_FragColor = vec4(newPos, 1.0);
            }
        `
	}

	getCurlNoiseCode() {
		return `
            vec3 mod289(vec3 x) {
              return x - floor(x * (1.0 / 289.0)) * 289.0;
            }

            vec4 mod289(vec4 x) {
              return x - floor(x * (1.0 / 289.0)) * 289.0;
            }

            vec4 permute(vec4 x) {
                 return mod289(((x*34.0)+1.0)*x);
            }

            vec4 taylorInvSqrt(vec4 r)
            {
              return 1.79284291400159 - 0.85373472095314 * r;
            }

            float snoise(vec3 v)
              {
              const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
              const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

            // First corner
              vec3 i  = floor(v + dot(v, C.yyy) );
              vec3 x0 =   v - i + dot(i, C.xxx) ;

            // Other corners
              vec3 g = step(x0.yzx, x0.xyz);
              vec3 l = 1.0 - g;
              vec3 i1 = min( g.xyz, l.zxy );
              vec3 i2 = max( g.xyz, l.zxy );

              //   x0 = x0 - 0.0 + 0.0 * C.xxx;
              //   x1 = x0 - i1  + 1.0 * C.xxx;
              //   x2 = x0 - i2  + 2.0 * C.xxx;
              //   x3 = x0 - 1.0 + 3.0 * C.xxx;
              vec3 x1 = x0 - i1 + C.xxx;
              vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
              vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

            // Permutations
              i = mod289(i);
              vec4 p = permute( permute( permute(
                         i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                       + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                       + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

            // Gradients: 7x7 points over a square, mapped onto an octahedron.
            // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
              float n_ = 0.142857142857; // 1.0/7.0
              vec3  ns = n_ * D.wyz - D.xzx;

              vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

              vec4 x_ = floor(j * ns.z);
              vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

              vec4 x = x_ *ns.x + ns.yyyy;
              vec4 y = y_ *ns.x + ns.yyyy;
              vec4 h = 1.0 - abs(x) - abs(y);

              vec4 b0 = vec4( x.xy, y.xy );
              vec4 b1 = vec4( x.zw, y.zw );

              vec4 s0 = floor(b0)*2.0 + 1.0;
              vec4 s1 = floor(b1)*2.0 + 1.0;
              vec4 sh = -step(h, vec4(0.0));

              vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
              vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

              vec3 p0 = vec3(a0.xy,h.x);
              vec3 p1 = vec3(a0.zw,h.y);
              vec3 p2 = vec3(a1.xy,h.z);
              vec3 p3 = vec3(a1.zw,h.w);

            //Normalise gradients
              vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
              p0 *= norm.x;
              p1 *= norm.y;
              p2 *= norm.z;
              p3 *= norm.w;

            // Mix final noise value
              vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
              m = m * m;
              return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                            dot(p2,x2), dot(p3,x3) ) );
              }


            vec3 snoiseVec3( vec3 x ){

              float s  = snoise(vec3( x ));
              float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
              float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
              vec3 c = vec3( s , s1 , s2 );
              return c;

            }


            vec3 curlNoise( vec3 p ){
              
              const float e = .1;
              vec3 dx = vec3( e   , 0.0 , 0.0 );
              vec3 dy = vec3( 0.0 , e   , 0.0 );
              vec3 dz = vec3( 0.0 , 0.0 , e   );

              vec3 p_x0 = snoiseVec3( p - dx );
              vec3 p_x1 = snoiseVec3( p + dx );
              vec3 p_y0 = snoiseVec3( p - dy );
              vec3 p_y1 = snoiseVec3( p + dy );
              vec3 p_z0 = snoiseVec3( p - dz );
              vec3 p_z1 = snoiseVec3( p + dz );

              float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
              float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
              float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

              const float divisor = 1.0 / ( 2.0 * e );
              return normalize( vec3( x , y , z ) * divisor );

            }
        `
	}

	updateTime(time) {
		this.material.uniforms.time.value = time
	}

	updateMouseData(mousePos, mouseVelocity, inactiveTime) {
		// Store previous mouse positions for trail effect
		this.positionHistory.pop() // Remove oldest position
		this.positionHistory.unshift(mousePos.clone()) // Add current position at start

		// Update current mouse data
		this.material.uniforms.mousePosition.value.copy(mousePos)
		this.material.uniforms.mouseVelocity.value.copy(mouseVelocity)
		this.material.uniforms.mouseInactiveTime.value = inactiveTime

		// Update previous mouse positions uniform
		for (let i = 0; i < 5; i++) {
			this.material.uniforms.previousMousePositions.value[i].copy(
				this.positionHistory[i]
			)
		}
	}

	getMaterial() {
		return this.material
	}

	// Enhanced control methods for the new system
	setMouseForceStrength(strength) {
		this.material.uniforms.mouseForceStrength.value = strength
	}

	setMouseInfluenceRadius(radius) {
		this.material.uniforms.mouseInfluenceRadius.value = radius
	}

	setMouseRepulsion(repulsion) {
		this.material.uniforms.mouseRepulsion.value = repulsion
	}

	setVelocityBoost(boost) {
		this.material.uniforms.velocityBoost.value = boost
	}

	setReturnSpeed(speed) {
		this.material.uniforms.returnSpeed.value = speed
	}

	// New control methods
	setTrailLength(length) {
		this.material.uniforms.trailLength.value = length
	}

	setDistortionAmount(amount) {
		this.material.uniforms.distortionAmount.value = amount
	}

	// Advanced configuration for trail effect weights
	setTrailWeights(weights) {
		if (weights.length === 5) {
			for (let i = 0; i < 5; i++) {
				this.material.uniforms.trailWeights.value[i] = weights[i]
			}
		}
	}
}
