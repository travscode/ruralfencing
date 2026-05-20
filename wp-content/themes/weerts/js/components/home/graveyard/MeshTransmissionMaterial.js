import * as THREE from 'three'

export default class MeshFresnelMaterial extends THREE.ShaderMaterial {
	constructor(envMap = null) {
		super()

		// Glass material properties
		this.transparent = true
		this.blending = THREE.NormalBlending
		this.depthWrite = false
		this.side = THREE.DoubleSide
		this.flatShading = false

		this.uniforms = {
			time: { value: 0 },
			fresnelColor: { value: new THREE.Color(0xffffff) },
			fresnelPower: { value: 3.0 },
			fresnelOpacity: { value: 0.6 },
			refractionRatio: { value: 1.5 },
			envMapIntensity: { value: 0.97 },
			reflectivity: { value: 0.9 },
			refractionStrength: { value: 0.1 },
			chromaticAberration: { value: 0.001 },
			dispersion: { value: 0.001 },
			// Oil slick effect parameters
			iridescenceIntensity: { value: 0.1 },
			iridescenceThickness: { value: 400.0 },
			rgbSplitIntensity: { value: 0.05 },
			spectralShift: { value: 0.15 },
		}

		// For equirectangular textures, we'll use a 2D sampler
		// The shader will handle the spherical mapping
		if (envMap && !envMap.isCubeTexture) {
			this.uniforms.envMap = { value: envMap }
			this.uniforms.hasEnvMap = { value: 1.0 }
			this.defines = { USE_ENVMAP_EQUIRECT: '' }
		} else {
			this.uniforms.envMap = { value: null }
			this.uniforms.hasEnvMap = { value: 0.0 }
		}

		this.vertexShader = /* glsl */ `
            uniform float refractionRatio;
            
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldPosition;
            varying vec3 vReflect;
            varying vec3 vRefract;
            varying vec3 vRefractR;
            varying vec3 vRefractG;
            varying vec3 vRefractB;
            varying float vReflectionFactor;
            varying vec3 vWorldNormal;

            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                
                // Calculate world normal
                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                
                // View space normal for fragment shader
                vNormal = normalize(normalMatrix * normal);
                vViewPosition = -mvPosition.xyz;
                vWorldPosition = worldPosition.xyz;
                
                // Calculate incident ray (from camera to vertex)
                vec3 cameraToVertex = normalize(worldPosition.xyz - cameraPosition);
                
                // Calculate reflection vector
                vReflect = reflect(cameraToVertex, vWorldNormal);
                
                // Calculate refraction with chromatic dispersion
                float ratio = 1.0 / refractionRatio;
                float dispersion = 0.02;
                
                vRefractR = refract(cameraToVertex, vWorldNormal, ratio * (1.0 - dispersion));
                vRefractG = refract(cameraToVertex, vWorldNormal, ratio);
                vRefractB = refract(cameraToVertex, vWorldNormal, ratio * (1.0 + dispersion));
                vRefract = vRefractG;
                
                // Calculate Fresnel factor (Schlick approximation)
                float cosTheta = 1.0 - max(0.0, dot(-cameraToVertex, vWorldNormal));
                vReflectionFactor = pow(cosTheta, 2.5);
                
                gl_Position = projectionMatrix * mvPosition;
            }
        `

		this.fragmentShader = /* glsl */ `
            uniform vec3 fresnelColor;
            uniform float fresnelPower;
            uniform float fresnelOpacity;
            uniform float reflectivity;
            uniform float refractionStrength;
            uniform float hasEnvMap;
            uniform float chromaticAberration;
            uniform float dispersion;
            uniform float envMapIntensity;
            uniform float time;
            
            // Oil slick effect uniforms
            uniform float iridescenceIntensity;
            uniform float iridescenceThickness;
            uniform float rgbSplitIntensity;
            uniform float spectralShift;
            
            #ifdef USE_ENVMAP_EQUIRECT
                uniform sampler2D envMap;
            #endif
            
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldPosition;
            varying vec3 vReflect;
            varying vec3 vRefract;
            varying vec3 vRefractR;
            varying vec3 vRefractG;
            varying vec3 vRefractB;
            varying float vReflectionFactor;
            varying vec3 vWorldNormal;

            const float PI = 3.14159265359;

            // Convert direction to equirectangular UV
            vec2 directionToEquirectUV(vec3 direction) {
                // Normalize direction
                vec3 dir = normalize(direction);
                
                // Convert to spherical coordinates
                float phi = atan(dir.z, dir.x);
                float theta = acos(clamp(dir.y, -1.0, 1.0));
                
                // Convert to UV coordinates
                vec2 uv = vec2(
                    0.5 + phi / (2.0 * PI),
                    theta / PI
                );
                
                return uv;
            }

            vec3 sampleEnvironment(vec3 direction) {
                #ifdef USE_ENVMAP_EQUIRECT
                    vec2 uv = directionToEquirectUV(direction);
                    return texture2D(envMap, uv).rgb;
                #else
                    return vec3(0.0);
                #endif
            }

            vec3 sampleEnvironmentRGB(vec3 dirR, vec3 dirG, vec3 dirB) {
                vec3 color = vec3(0.0);
                #ifdef USE_ENVMAP_EQUIRECT
                    color.r = texture2D(envMap, directionToEquirectUV(dirR)).r;
                    color.g = texture2D(envMap, directionToEquirectUV(dirG)).g;
                    color.b = texture2D(envMap, directionToEquirectUV(dirB)).b;
                #endif
                return color;
            }

            // Thin-film interference calculation for oil slick effect
            vec3 thinFilmInterference(float cosTheta, float thickness) {
                // Wavelengths for RGB in nanometers
                vec3 lambda = vec3(650.0, 550.0, 450.0); // R, G, B wavelengths
                
                // Calculate optical path difference
                float pathDiff = 2.0 * thickness * sqrt(1.0 - cosTheta * cosTheta);
                
                // Calculate phase shift for each wavelength
                vec3 phase = 2.0 * PI * pathDiff / lambda;
                
                // Create interference pattern
                vec3 interference = 0.5 + 0.5 * cos(phase);
                
                return interference;
            }

            // Spectral color shift for rainbow effect
            vec3 spectralColor(float t) {
                vec3 color;
                t = fract(t);
                
                if (t < 0.166) {
                    color = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 0.0, 1.0), t * 6.0);
                } else if (t < 0.333) {
                    color = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), (t - 0.166) * 6.0);
                } else if (t < 0.5) {
                    color = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t - 0.333) * 6.0);
                } else if (t < 0.666) {
                    color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.5) * 6.0);
                } else if (t < 0.833) {
                    color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (t - 0.666) * 6.0);
                } else {
                    color = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 1.0), (t - 0.833) * 6.0);
                }
                
                return color;
            }

            vec3 adjustContrast(vec3 color, float contrast) {
                return ((color - 0.5) * contrast) + 0.5;
            }

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                
                // Calculate view-dependent metrics
                float NdotV = abs(dot(normal, viewDir));
                float fresnel = pow(1.0 - NdotV, fresnelPower);
                
                // Calculate iridescence (oil slick effect)
                float thickness = iridescenceThickness * (0.5 + 0.5 * sin(vWorldPosition.x * 0.1 + vWorldPosition.y * 0.15 + time * 0.5));
                vec3 iridescence = thinFilmInterference(NdotV, thickness);
                
                // Add spectral shifting based on surface position and viewing angle
                float spectralT = dot(vWorldPosition.xy, vec2(0.01, 0.015)) + fresnel * spectralShift;
                vec3 spectral = spectralColor(spectralT + time * 0.1);
                
                // Base glass tint with iridescence
                vec3 glassColor = vec3(0.98, 0.99, 1.0);
                glassColor = mix(glassColor, iridescence * spectral, iridescenceIntensity * fresnel);
                
                vec3 finalColor = glassColor;
                
                // Enhanced RGB splitting for environment mapping
                if (hasEnvMap > 0.5) {
                    // Calculate enhanced chromatic aberration based on viewing angle
                    float rgbSplit = rgbSplitIntensity * (1.0 + fresnel * 2.0);
                    
                    // Sample reflection with RGB splitting
                    vec3 reflectOffset = normal * rgbSplit;
                    vec3 reflectedColor;
                    reflectedColor.r = sampleEnvironment(vReflect + reflectOffset * 1.2).r;
                    reflectedColor.g = sampleEnvironment(vReflect).g;
                    reflectedColor.b = sampleEnvironment(vReflect - reflectOffset * 1.2).b;
                    
                    // Enhanced refraction with stronger chromatic aberration
                    vec3 refractedColor;
                    float aberrationStrength = chromaticAberration * (1.0 + fresnel * 3.0);
                    
                    // Create more dramatic RGB separation
                    vec3 refractR = vRefractR + normal * aberrationStrength * 2.0;
                    vec3 refractG = vRefractG;
                    vec3 refractB = vRefractB - normal * aberrationStrength * 2.0;
                    
                    refractedColor = sampleEnvironmentRGB(refractR, refractG, refractB);
                    
                    // Apply environment intensity
                    reflectedColor *= envMapIntensity;
                    refractedColor *= envMapIntensity;
                    
                    // Add iridescent tint to environment colors
                    reflectedColor *= (vec3(1.0) + iridescence * iridescenceIntensity);
                    refractedColor *= (vec3(1.0) + spectral * iridescenceIntensity * 0.5);
                    
                    // Mix reflection and refraction with enhanced Fresnel
                    vec3 envColor = mix(
                        refractedColor * refractionStrength,
                        reflectedColor,
                        vReflectionFactor + fresnel * 0.5
                    );
                    
                    // Blend with iridescent glass color
                    finalColor = mix(glassColor, envColor, reflectivity);
                    
                    // Add prismatic edge coloring
                    vec3 edgeColor = spectral * fresnel;
                    finalColor += edgeColor * 0.1;
                } else {
                    // No environment map - use iridescent glass appearance
                    finalColor = mix(glassColor, spectral * fresnelColor, fresnel * 0.5);
                }
                
                // Calculate opacity with iridescence influence
                float alpha = mix(0.025, fresnelOpacity, fresnel * (1.0 + iridescenceIntensity * 0.3));
                
                // Add rainbow internal reflections
                float internalReflection = pow(1.0 - fresnel, 3.0) * 0.05;
                finalColor += spectral * internalReflection * 2.0;
                
                finalColor = adjustContrast(finalColor, 1.5);
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `

		this.needsUpdate = true
	}

	// Convenience methods for updating uniforms
	set time(value) {
		this.uniforms.time.value = value
	}

	get time() {
		return this.uniforms.time.value
	}

	setFresnelColor(color) {
		this.uniforms.fresnelColor.value = color
	}

	setFresnelPower(power) {
		this.uniforms.fresnelPower.value = power
	}

	setFresnelOpacity(opacity) {
		this.uniforms.fresnelOpacity.value = opacity
	}

	setRefractionRatio(ratio) {
		this.uniforms.refractionRatio.value = ratio
	}

	setReflectivity(reflectivity) {
		this.uniforms.reflectivity.value = reflectivity
	}

	setRefractionStrength(strength) {
		this.uniforms.refractionStrength.value = strength
	}

	setChromaticAberration(strength) {
		this.uniforms.chromaticAberration.value = strength
	}

	setDispersion(value) {
		this.uniforms.dispersion.value = value
	}

	setEnvMapIntensity(intensity) {
		this.uniforms.envMapIntensity.value = intensity
	}

	// Oil slick effect controls
	setIridescenceIntensity(intensity) {
		this.uniforms.iridescenceIntensity.value = intensity
	}

	setIridescenceThickness(thickness) {
		this.uniforms.iridescenceThickness.value = thickness
	}

	setRGBSplitIntensity(intensity) {
		this.uniforms.rgbSplitIntensity.value = intensity
	}

	setSpectralShift(shift) {
		this.uniforms.spectralShift.value = shift
	}

	setEnvironmentMap(envMap) {
		if (envMap && !envMap.isCubeTexture) {
			this.uniforms.envMap = { value: envMap }
			this.uniforms.hasEnvMap = { value: 1.0 }
			this.defines = { USE_ENVMAP_EQUIRECT: '' }
		} else {
			this.uniforms.envMap = { value: null }
			this.uniforms.hasEnvMap = { value: 0.0 }
			this.defines = {}
		}

		this.needsUpdate = true
	}
}
