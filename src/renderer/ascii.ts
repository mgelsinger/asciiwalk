import * as THREE from 'three';
import type { SignLayer } from './signs';

const vertex = `precision highp float; in vec3 position; out vec2 vUv; void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment = `precision highp float;
  uniform sampler2D tColor,tInfo,tDepth,tAtlas,tSigns;
  uniform vec2 uSize,uGrid; uniform float uMono,uContrast,uNear,uFar; uniform int uDebug;
  in vec2 vUv; out vec4 outColor;
  float linearDepth(float z){ return (2.*uNear*uFar)/(uFar+uNear-(z*2.-1.)*(uFar-uNear)); }
  float glyph(float code,vec2 p){ float i=code-32.; vec2 tile=vec2(mod(i,16.),floor(i/16.)); return texture(tAtlas,(tile+vec2(p.x,1.-p.y))/vec2(16.,6.)).r; }
  float ramp(float l){ if(l<.12)return 46.; if(l<.22)return 58.;if(l<.33)return 45.;if(l<.44)return 61.;if(l<.56)return 43.;if(l<.68)return 42.;if(l<.79)return 35.;if(l<.9)return 37.;return 64.; }
  void main(){
    vec2 cell=floor(vUv*uGrid), uv=(cell+.5)/uGrid, local=fract(vUv*uGrid);
    vec3 c=texture(tColor,uv).rgb;vec4 info=texture(tInfo,uv);float d=texture(tDepth,uv).r;
    if(uDebug==1){outColor=vec4(texture(tColor,vUv).rgb,1.);return;}
    if(uDebug==2){outColor=vec4(texture(tInfo,vUv).rgb,1.);return;}
    float s=floor(info.a*16.+.5), lum=dot(c,vec3(.2126,.7152,.0722));
    float code=ramp(clamp((lum-.12)*uContrast,0.,1.));
    vec2 delta=1./uGrid;
    float left=linearDepth(texture(tDepth,uv-vec2(delta.x,0.)).r),right=linearDepth(texture(tDepth,uv+vec2(delta.x,0.)).r);
    float up=linearDepth(texture(tDepth,uv+vec2(0.,delta.y)).r),down=linearDepth(texture(tDepth,uv-vec2(0.,delta.y)).r);
    float depth=linearDepth(d);vec2 edge=vec2(right-left,up-down)/max(depth,1.);
    float edgeLength=length(edge);
    float curvature=max(abs(left+right-2.*depth),abs(up+down-2.*depth))/max(depth,1.);
    vec3 normalL=texture(tInfo,uv-vec2(delta.x,0.)).rgb,normalR=texture(tInfo,uv+vec2(delta.x,0.)).rgb;
    vec3 normalU=texture(tInfo,uv+vec2(0.,delta.y)).rgb,normalD=texture(tInfo,uv-vec2(0.,delta.y)).rgb;
    float normalEdge=max(length(normalL-normalR),length(normalU-normalD));
    if(s==1.)code=lum>.66?64.:lum>.48?35.:lum>.3?42.:43.;
    if(s==2.){code=lum>.5?46.:32.;c*=.6;}
    if(s==3.)code=lum>.45?61.:45.;
    if(s==4.)code=lum>.5?35.:lum>.35?42.:43.;
    if(s==5.){code=46.;c*=.65;}
    if(s==6.)code=61.;
    if(s==7.)code=126.;
    if(s==10.)code=lum>.46?58.:46.;
    if(s==11.)code=lum>.65?37.:35.;
    if(s==12.)code=lum>.75?43.:lum>.5?61.:45.;
    if(s==13.)code=124.;
    if(s==14.)code=35.;
    if(s==15.){code=46.;c*=.55;}
    if(edgeLength>.06&&(curvature>.14||normalEdge>.35)&&s!=4.&&s!=10.&&s!=5.&&d<.999999){
      if(abs(edge.x)>abs(edge.y)*1.9)code=124.;
      else if(abs(edge.y)>abs(edge.x)*1.9)code=95.;
      else code=edge.x*edge.y>0.?47.:92.;
      c=mix(c,vec3(.78,.83,.78),.22);
    }
    if(d>.999999){code=46.;c=vec3(.17,.26,.29);if(mod(cell.x+cell.y*3.,7.)>1.)code=32.;}
    vec4 sign=texture(tSigns,uv);
    if(sign.a>.5&&linearDepth(sign.g)<depth+.35){code=sign.r;c=vec3(.90,.91,.75);}
    if(uMono>.5){float l=dot(c,vec3(.2126,.7152,.0722));c=vec3(l*.92,l,l*.94);}
    vec3 background=vec3(.0235,.0353,.0392);
    float ink=glyph(code,local);
    outColor=vec4(mix(background,clamp(c*(1.03+uContrast*.2),0.,1.),ink),1.);
  }`;

export class AsciiRenderer {
  renderer: THREE.WebGLRenderer;
  target: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  pass: THREE.RawShaderMaterial;
  atlas: THREE.CanvasTexture;
  cellWidth = 7;
  cellHeight = 11;
  grid = new THREE.Vector2();
  signs?: SignLayer;
  width = 0;
  height = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = true;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      count: 2,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    const font = document.createElement('canvas');
    font.width = 16 * 16;
    font.height = 6 * 24;
    const ctx = font.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, font.width, font.height);
    ctx.fillStyle = '#fff';
    ctx.font = '500 21px "IBM Plex Mono"';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let i = 0; i < 95; i++)
      ctx.fillText(String.fromCharCode(i + 32), (i % 16) * 16 + 8, Math.floor(i / 16) * 24 + 12);
    this.atlas = new THREE.CanvasTexture(font);
    this.atlas.flipY = false;
    this.atlas.minFilter = THREE.LinearFilter;
    this.atlas.magFilter = THREE.LinearFilter;
    this.atlas.generateMipmaps = false;
    this.pass = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.textures[0] },
        tInfo: { value: this.target.textures[1] },
        tDepth: { value: this.target.depthTexture },
        tAtlas: { value: this.atlas },
        tSigns: {
          value: new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType),
        },
        uSize: { value: new THREE.Vector2() },
        uGrid: { value: this.grid },
        uMono: { value: 0 },
        uContrast: { value: 1.25 },
        uNear: { value: 0.15 },
        uFar: { value: 5000 },
        uDebug: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.pass));
  }
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid.set(Math.ceil(width / this.cellWidth), Math.ceil(height / this.cellHeight));
    this.renderer.setSize(width, height, false);
    this.target.setSize(this.grid.x * 2, this.grid.y * 2);
    this.pass.uniforms.uSize.value.set(width, height);
  }
  density(value: string) {
    const sizes: Record<string, [number, number]> = { coarse: [10, 16], balanced: [7, 11], fine: [5, 8] };
    [this.cellWidth, this.cellHeight] = sizes[value] ?? sizes.balanced;
    this.resize(this.width, this.height);
  }
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (this.signs)
      this.pass.uniforms.tSigns.value = this.signs.update(
        camera,
        this.grid.x,
        this.grid.y,
        this.cellHeight,
        this.height,
      );
    this.pass.uniforms.uNear.value = camera.near;
    this.pass.uniforms.uFar.value = camera.far;
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x354b53, 1);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.target.dispose();
    this.atlas.dispose();
    this.pass.dispose();
    this.renderer.dispose();
  }
}
