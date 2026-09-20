import * as THREE from 'three';

export const SURFACE = {
  wall: 1,
  window: 2,
  roof: 3,
  leaf: 4,
  road: 5,
  paint: 6,
  water: 7,
  person: 8,
  metal: 9,
  ground: 10,
  trim: 11,
  stone: 12,
  fluted: 13,
  mesh: 14,
  court: 15,
} as const;

export function worldMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `precision highp float;
      uniform mat4 modelMatrix, modelViewMatrix, projectionMatrix;
      uniform mat3 normalMatrix;
      in vec3 position, normal, color; in float surface;
      out vec3 vColor, vNormal, vWorld, vView; flat out float vSurface;
      void main(){ vec4 p=modelViewMatrix*vec4(position,1.); vView=p.xyz; vWorld=(modelMatrix*vec4(position,1.)).xyz;
        vColor=color; vNormal=normalize(normalMatrix*normal); vSurface=surface; gl_Position=projectionMatrix*p; }`,
    fragmentShader: `precision highp float;
      uniform mat4 viewMatrix; uniform float uTime;
      in vec3 vColor,vNormal,vWorld,vView; flat in float vSurface;
      layout(location=0) out vec4 sceneColor; layout(location=1) out vec4 sceneInfo;
      void main(){ vec3 n=normalize(vNormal); if(!gl_FrontFacing)n=-n;
        if(vSurface>13.5&&vSurface<14.5&&fract((vWorld.x+vWorld.z)*5.)>.13&&fract(vWorld.y*5.)>.13)discard;
        vec3 sun=normalize((viewMatrix*vec4(-.45,.8,.4,0.)).xyz);
        float light=.55+.52*max(dot(n,sun),0.);
        float pattern=1.;
        if(vSurface<1.5){ float y=fract(vWorld.y*1.6); float x=fract((vWorld.x+vWorld.z)*1.0+floor(vWorld.y*1.6)*.5);
          pattern=(y<.065||x<.025)?.88:1.; }
        if(vSurface>9.5&&vSurface<10.5)pattern=.96+.04*sin(vWorld.x*.23)*sin(vWorld.z*.31);
        vec3 color=vColor*light*pattern;
        if(vSurface>6.5&&vSurface<7.5) color*=.87+.13*sin(vWorld.x*2.4+vWorld.z*1.7-uTime*2.1);
        if(vSurface>1.5&&vSurface<2.5) color=mix(color,vec3(.19,.35,.40),.15);
        float fog=1.-exp(-max(0.,length(vView)-180.)*.0005);
        color=mix(color,vec3(.20,.30,.31),fog*.7);
        sceneColor=vec4(pow(clamp(color,0.,1.),vec3(1./2.2)),1.);
        sceneInfo=vec4(n*.5+.5,vSurface/16.);
      }`,
  });
}
