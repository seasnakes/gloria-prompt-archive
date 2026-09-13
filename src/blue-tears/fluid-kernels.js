export const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const noise = /* glsl */ `
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),
      mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) {
    float f=0.0, a=.5;
    mat2 m=mat2(.8,-.6,.6,.8);
    for(int i=0;i<5;i++){f+=a*noise2(p);p=m*p*2.03+17.17;a*=.5;}
    return f;
  }
  vec3 pigment(vec2 uv, float aspect, float seed) {
    vec2 p=(uv-.5)*vec2(aspect,1.)*3.4;
    vec2 q=vec2(noise2(p+vec2(seed,4.3)),noise2(p+vec2(5.8,seed)));
    vec2 r=vec2(noise2(p*.81+q*2.7+vec2(14.2,seed)),
      noise2(p*.93+q*2.5+vec2(seed,8.7)));
    vec2 warped=p+q*2.1+r*1.6;
    float density=noise2(warped)*.78+noise2(warped*2.03+12.7)*.22;
    return vec3(.14+density*.75,.2+q.x*.62,.18+r.y*.65);
  }


`;

export const seed = /* glsl */ `
  varying vec2 vUv;
  uniform float uAspect, uSeed, uVelocity;
  ${noise}
  void main() {
    if (uVelocity > .5) {
      vec2 p = vUv * vec2(uAspect,1.) * 2.2 + uSeed;
      float e=.01;
      vec2 vel=vec2(noise2(p+vec2(0,e))-noise2(p-vec2(0,e)),
        noise2(p-vec2(e,0))-noise2(p+vec2(e,0)))/e;
      gl_FragColor=vec4(vel*.65,0,1);
    } else gl_FragColor=vec4(pigment(vUv,uAspect,uSeed),1);
  }
`;

export const advection = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uVelocity, uSource;
  uniform vec2 uTexel;
  uniform float uDt, uDecay;
  void main() {
    vec2 velocity = texture2D(uVelocity,vUv).xy;
    vec2 uv = clamp(vUv - uDt * velocity * uTexel, vec2(.001), vec2(.999));
    gl_FragColor = texture2D(uSource,uv) / (1.0 + uDecay * uDt);
    gl_FragColor.a = 1.0;
  }
`;
export const curl = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  void main() {
    float l = texture2D(uVelocity,vUv-vec2(uTexel.x,0)).y;
    float r = texture2D(uVelocity,vUv+vec2(uTexel.x,0)).y;
    float b = texture2D(uVelocity,vUv-vec2(0,uTexel.y)).x;
    float t = texture2D(uVelocity,vUv+vec2(0,uTexel.y)).x;
    gl_FragColor=vec4(.5*(r-l-t+b),0,0,1);
  }
`;
export const forces = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uVelocity,uLayers;
  uniform vec2 uTexel;
  uniform float uDt;
  void main(){
    vec2 v=texture2D(uVelocity,vUv).xy;
    vec2 average=(texture2D(uVelocity,vUv+vec2(uTexel.x,0)).xy+texture2D(uVelocity,vUv-vec2(uTexel.x,0)).xy+
      texture2D(uVelocity,vUv+vec2(0,uTexel.y)).xy+texture2D(uVelocity,vUv-vec2(0,uTexel.y)).xy)*.25;
    v=mix(v,average,min(uDt*3.,.18));
    vec3 layers=texture2D(uLayers,vUv).rgb;
    // A transient vertical plume replaces sustained vorticity amplification.
    v.y+=(layers.g*5.+layers.b*14.-layers.r*3.0)*uDt;
    if(vUv.x<uTexel.x*1.5 || vUv.x>1.-uTexel.x*1.5)v.x=0.;
    if(vUv.y<uTexel.y*1.5 || vUv.y>1.-uTexel.y*1.5)v.y=0.;
    gl_FragColor=vec4(clamp(v,vec2(-100),vec2(100)),0.,1.);
  }
`;
export const divergence = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  void main() {
    float l=texture2D(uVelocity,vUv-vec2(uTexel.x,0)).x;
    float r=texture2D(uVelocity,vUv+vec2(uTexel.x,0)).x;
    float b=texture2D(uVelocity,vUv-vec2(0,uTexel.y)).y;
    float t=texture2D(uVelocity,vUv+vec2(0,uTexel.y)).y;
    vec2 c=texture2D(uVelocity,vUv).xy;
    if(vUv.x<uTexel.x) l=-c.x;
    if(vUv.x>1.-uTexel.x) r=-c.x;
    if(vUv.y<uTexel.y) b=-c.y;
    if(vUv.y>1.-uTexel.y) t=-c.y;
    gl_FragColor=vec4(.5*(r-l+t-b),0,0,1);
  }
`;
export const pressure = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uPressure, uDivergence;
  uniform vec2 uTexel;
  void main() {
    float l=texture2D(uPressure,vUv-vec2(uTexel.x,0)).x;
    float r=texture2D(uPressure,vUv+vec2(uTexel.x,0)).x;
    float b=texture2D(uPressure,vUv-vec2(0,uTexel.y)).x;
    float t=texture2D(uPressure,vUv+vec2(0,uTexel.y)).x;
    float div=texture2D(uDivergence,vUv).x;
    gl_FragColor=vec4((l+r+b+t-div)*.25,0,0,1);
  }
`;
export const project = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uPressure, uVelocity;
  uniform vec2 uTexel;
  void main() {
    float l=texture2D(uPressure,vUv-vec2(uTexel.x,0)).x;
    float r=texture2D(uPressure,vUv+vec2(uTexel.x,0)).x;
    float b=texture2D(uPressure,vUv-vec2(0,uTexel.y)).x;
    float t=texture2D(uPressure,vUv+vec2(0,uTexel.y)).x;
    vec2 v=texture2D(uVelocity,vUv).xy-vec2(r-l,t-b);
    if(vUv.x<uTexel.x || vUv.x>1.-uTexel.x) v.x=0.;
    if(vUv.y<uTexel.y || vUv.y>1.-uTexel.y) v.y=0.;
    gl_FragColor=vec4(v,0,1);
  }
`;
export const splat = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uSource;
  uniform vec2 uPoint, uForce;
  uniform float uRadius, uAspect, uDye, uTime;
  void main() {
    vec2 p=(vUv-uPoint)*vec2(uAspect,1.);
    float influence=exp(-dot(p,p)/uRadius);
    vec3 c=texture2D(uSource,vUv).rgb;
    if(uDye>.5) {
      float bipolar=sin(p.x*28.+p.y*19.);
      c.r=clamp(c.r+bipolar*influence*.035,.08,.92);
      c.gb=mix(c.gb,vec2(.48+.2*sin(uTime*.7),.53+.15*cos(uTime)),influence*.025);
    } else {
      c.xy+=uForce*influence;
      // Directional momentum only: no tangential spin around the touch point.
    }
    gl_FragColor=vec4(c,1.);
  }
`;
export const refresh = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uSource;
  uniform float uAspect,uSeed,uTime,uDt,uAuto;
  ${noise}
  void main() {
    vec3 c=texture2D(uSource,vUv).rgb;
    // Restore a balanced material field; never continuously inject cyan dye.
    vec2 drift=vec2(sin(uTime*.023),cos(uTime*.019))*.065;
    vec3 fresh=pigment(vUv+drift,uAspect,uSeed);
    c=mix(c,fresh,(1.-exp(-uDt*.035))*uAuto);
    gl_FragColor=vec4(clamp(c,vec3(.04),vec3(.96)),1.);
  }
`;
