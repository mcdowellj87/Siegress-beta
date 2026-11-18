import * as THREE from 'three';

// A final color pass gives textured scenery, water, sky and effects one palette.
export function createWorldCelShading(renderer) {
  const size = new THREE.Vector2();
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType, depthBuffer: true
  });
  target.samples = renderer.capabilities.isWebGL2 ? 4 : 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { world: { value: target.texture } },
    depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec2 screenUv;
      void main(){screenUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader: `uniform sampler2D world; varying vec2 screenUv;
      void main(){
        vec3 color=texture2D(world,screenUv).rgb;
        vec3 display=mix(color*12.92,1.055*pow(max(color,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),color));
        float light=dot(display,vec3(.2126,.7152,.0722));
        // Flat brightness bands preserve each surface's hue and deep shadows.
        float band=floor(clamp(light,0.0,1.0)*9.0+.5)/9.0;
        band=max(.025,band);
        vec3 painted=display*band/max(.001,light);
        painted=mix(display,painted,.85);
        color=mix(painted/12.92,pow(max((painted+.055)/1.055,vec3(0.0)),vec3(2.4)),step(vec3(.04045),painted));
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }`
  });
  const pass = new THREE.Scene();
  pass.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.Camera();
  return {
    render(scene, view) {
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(scene, view);
      renderer.setRenderTarget(previous);
      renderer.render(pass, camera);
    }
  };
}
