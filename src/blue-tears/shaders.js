import { noise } from './fluid-kernels.js';
import { tidalMotion } from './tidal-motion.js';
export * from './fluid-kernels.js';
export * from './settling-shaders.js';

export const surface = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uDye,uVelocity,uLayers,uSuspension;
  uniform vec2 uTexel,uResolution;
  uniform float uShimmer,uPalette,uSeed,uDetail;
  ${tidalMotion}
  ${noise}

  float tidePhase(vec2 uv) {
    vec3 d=texture2D(uDye,uv).rgb;
    vec2 p=(uv-.5)*vec2(uAspect,1.);
    // Advected material plus a small optical distortion gives irregular tide edges.
    float detail=fbm(p*5.2+vec2(d.g,d.b)*2.4+uSeed);
    float wave=p.y*3.6+p.x*.8+d.r*7.5+d.g*3.0+detail*1.4;
    return .5+.34*sin(wave);
  }
  vec3 wingColor(float phase) {
    // Deep violet appears on oblique faces; illuminated faces stay electric blue.
    float cobalt=.5+.5*sin(phase);
    float electric=pow(.5+.5*sin(phase*.83+2.5),2.);
    vec3 c=mix(vec3(.037,.095,.40),vec3(.028,.215,.81),cobalt);
    c=mix(c,vec3(.026,.325,.83),electric*.35);
    float violet=pow(.5+.5*sin(phase*.71-1.1),2.)*(.80-.55*cobalt);
    return mix(c,vec3(.145,.026,.34),violet*.80);
  }
  void main() {
    vec2 p=materialAt((vUv-.5)*vec2(uAspect,1.));
    vec2 uv=p/vec2(uAspect,1.)+.5;
    vec3 dye=texture2D(uDye,uv).rgb;
    vec2 velocity=texture2D(uVelocity,uv).xy;
    float h=tidePhase(uv);
    // Bounded contour width keeps stretched folds soft without black cracks.
    float target=.505+.018*sin(uTime*.10+uTilt.x*.8);
    vec2 phaseGradient=vec2(dFdx(h)*uResolution.x/uAspect,dFdy(h)*uResolution.y);
    float contourScale=clamp(length(phaseGradient),1.8,5.1);
    float distanceToFront=abs(h-target)/contourScale;
    float fringe=fbm(p*8.5+vec2(dye.g,dye.b)*4.3);
    float width=.013+fringe*.013;
    float crest=exp(-pow(distanceToFront/width,2.));
    float halo=exp(-pow(distanceToFront/(width*2.5),2.));
    float inner=exp(-pow(distanceToFront/(width*.60),2.));
    float breath=.12+.88*smoothstep(.34,.66,fringe);
    crest*=breath;halo*=breath;inner*=breath;

    float optical=fbm(p*2.3+vec2(dye.g,dye.b)*2.1+uSeed*.2);
    float phase=optical*11.+dye.g*4.+dye.b*3.+uTilt.x*2.8+uTilt.y*1.7+sin(uTime*.065)*.35;
    vec3 col=wingColor(phase);
    float cloud=fbm(p*5.5+vec2(dye.g,dye.b)*3.7);
    col*=.87+cloud*.39;
    // Soft blue pigment remains visible between the more luminous folds.
    col+=vec3(.018,.033,.05)*cloud;
    vec3 turquoise=vec3(.015,.9,1.08);
    vec3 hot=vec3(.025,.78,1.4);
    if(uPalette>.5 && uPalette<1.5) {
      col=mix(col,vec3(.03,.30,.78),.27);
      turquoise=vec3(.03,.98,1.14);hot=vec3(.035,.89,1.45);
    } else if(uPalette>1.5) {
      col*=vec3(.72,.76,.87);turquoise=vec3(.03,.58,1.12);hot=vec3(.030,.65,1.45);
    }
    // Narrow emissive fronts sit in the blue body; halo never covers the body.
    float broken=.55+.45*noise2(p*55.+vec2(dye.g,dye.b)*18.);
    vec3 sheetNormal=normalize(vec3(-sheetSlope(p),1.));
    float lightAngle=max(dot(sheetNormal,normalize(vec3(-.19,.13,1.))),0.);
    float pearlescence=.42+.77*pow(lightAngle,12.);
    col+=turquoise*(crest*.67+halo*.24)*broken*pearlescence;
    col+=hot*inner*.050*pearlescence;
    // A light suspension travels upward separately from the settling flakes.
    vec3 layers=texture2D(uLayers,uv).rgb;
    float air=layers.g+layers.b*.22;
    float plume=air*(.42+.58*fbm(p*7.+vec2(0.,-uTime*.10)));
    col+=vec3(.010,.13,.40)*plume;
    // Real particle concentration gives the underlying liquid the same moving body.
    vec2 concentration=texture2D(uSuspension,vUv).rg;
    float bulk=1.-exp(-concentration.r*1.6);
    float settled=1.-exp(-concentration.g*2.0);
    col*=.92+bulk*.20;
    col=mix(col,col*vec3(1.16,.80,.98),settled*.30);
    col+=vec3(.012,.047,.16)*bulk*pearlescence;
    // A fine translucent suspension, without stretched screen-space ridges.
    vec2 material=p+vec2(dye.g-.5,dye.b-.5)*.19;
    float dust=hash21(floor(material*1500.));
    float mica=noise2(material*570.);
    col*=.89+dust*.15+mica*.12;
    col+=vec3(.018,.052,.11)*layers.r*(.45+mica*.55);
    float micro=pow(max(0.,noise2(material*920.)-.58)*2.38,4.);
    col+=vec3(.16,.32,.72)*micro*uShimmer*.30;
    float edge=1.-smoothstep(.3,.9,length((vUv-.5)*vec2(1.,.85)))*.10;
    col*=edge;
    col=vec3(1.)-exp(-col*1.55);
    col=pow(col,vec3(.87));
    gl_FragColor=vec4(col,1.);
  }
`;

export const particleVertex = /* glsl */ `
  attribute vec2 aSeed;
  uniform sampler2D uPositions,uDye,uVelocity;
  uniform float uPixelRatio,uShimmer,uPalette,uSeed,uDetail;
  varying float vAlpha,vTone,vShape,vAngle,vGlint,vFace,vHue;
  ${noise}
  ${tidalMotion}
  void main(){
    vec4 state=texture2D(uPositions,uv);
    vec2 rest=(state.xy-.5)*vec2(uAspect,1.);
    vec2 wave=sheetDisplacement(rest);
    vec2 p=rest+wave*(.92+aSeed.y*.12);
    vec2 slope=sheetSlope(rest);
    vec3 d=texture2D(uDye,state.xy).rgb;
    vec2 flow=texture2D(uVelocity,state.xy).xy;
    vec2 rnd=aSeed;
    vec2 facetSlope=slope+vec2((d.r-.5)*.7,(d.g-.5)*.4);
    facetSlope+=(rnd-.5)*.66+flow*.0010;
    vec3 normal=normalize(vec3(-facetSlope,1.));
    float pitch=sin(state.w)*(.22+state.z*.78);
    normal=vec3(normal.x,normal.y*cos(pitch)-normal.z*sin(pitch),normal.y*sin(pitch)+normal.z*cos(pitch));
    vFace=.48+.52*abs(normal.z);
    float align=max(dot(normal,normalize(vec3(-.19,.13,1.))),0.);
    float reflection=pow(align,mix(35.,135.,rnd.x));
    float broad=pow(align,10.);
    // A visible fine star field remains even away from the specular wave.
    vAlpha=(.16+state.z*.18+broad*.12+reflection*1.45)*uShimmer;
    vGlint=reflection;
    vHue=clamp((1.-abs(normal.z))*1.6+.20*sin(d.r*5.+d.g*3.+slope.x*1.3),0.,1.);
    vTone=rnd.y;vShape=rnd.x;
    vec2 drift=sheetDrift(rest)+flow*.0005;
    vAngle=atan(drift.y+.002,drift.x+.002)*.40+rnd.x*6.283+sin(state.w*.73)*.34;
    float size=.95+pow(rnd.x,4.)*1.65;
    gl_PointSize=(size+reflection*1.20)*uPixelRatio;
    gl_Position=vec4(p.x/uAspect*2.,p.y*2.,0,1);
  }
`;
export const particleFragment = /* glsl */ `
  varying float vAlpha,vTone,vShape,vAngle,vGlint,vFace,vHue;
  void main(){
    vec2 p=gl_PointCoord-.5;
    vec2 q=mat2(cos(vAngle),-sin(vAngle),sin(vAngle),cos(vAngle))*p;
    q.y*=(1.+vShape*.9)/vFace;
    float facet=max(abs(q.x)*.95,abs(q.y));
    float silhouette=1.-smoothstep(.23,.44,facet);
    silhouette*=1.-smoothstep(.30,.44,q.x+q.y);
    float glare=exp(-dot(p,p)*17.)*.14*vGlint;
    vec3 pigment=mix(vec3(.032,.085,.32),vec3(.18,.026,.40),vHue);
    vec3 electric=mix(vec3(.025,.44,1.),vec3(.035,.88,1.),vTone);
    vec3 col=mix(pigment,electric,smoothstep(.020,.40,vGlint));
    gl_FragColor=vec4(col,min((silhouette+glare)*vAlpha,.88));
  }
`;

export const densityVertex = /* glsl */ `
  attribute vec2 aSeed;
  uniform sampler2D uPositions;
  varying float vLoad;
  ${tidalMotion}
  void main(){
    vec4 state=texture2D(uPositions,uv);
    vec2 rest=(state.xy-.5)*vec2(uAspect,1.);
    vec2 p=rest+sheetDisplacement(rest)*(.92+aSeed.y*.12);
    vLoad=state.z;
    gl_PointSize=3.5;
    gl_Position=vec4(p.x/uAspect*2.,p.y*2.,0.,1.);
  }
`;
export const densityFragment = /* glsl */ `
  varying float vLoad;
  void main(){
    vec2 p=gl_PointCoord-.5;
    float density=exp(-dot(p,p)*15.)*.070;
    gl_FragColor=vec4(density,density*vLoad,0.,1.);
  }
`;
