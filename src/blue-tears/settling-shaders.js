import { noise } from './fluid-kernels.js';

// R is settling, G is airy suspension, B is the user's upward lift.
export const layerSplat = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uSource;
  uniform vec2 uPoint;
  uniform float uAspect,uRadius,uAmount,uDirection;
  void main(){
    vec2 p=(vUv-uPoint)*vec2(uAspect,1.);
    vec2 down=(p+vec2(0.,.025))/vec2(1.25,.78);
    vec2 air=(p-vec2(0.,.085))/vec2(.85,1.12);
    float downMask=exp(-dot(down,down)/uRadius);
    float airMask=exp(-dot(air,air)/(uRadius*.75));
    float rise=max(uDirection,0.);
    float fall=max(-uDirection,0.);
    // The upward stroke reaches the sediment underneath the moving hand.
    float column=exp(-p.x*p.x/(uRadius*1.8));
    float tail=(1.-smoothstep(.04,.17,p.y))*smoothstep(-1.02,-.80,p.y);
    float liftMask=column*max(exp(-p.y*p.y/(uRadius*1.5)),tail*.78);
    vec3 layer=texture2D(uSource,vUv).rgb;
    layer.r*=exp(-liftMask*rise*uAmount*4.5);
    layer.b*=exp(-downMask*fall*uAmount*2.5);
    layer+=vec3(downMask*(fall+.10*(1.-rise)),airMask*.55,liftMask*rise*1.8)*uAmount;
    gl_FragColor=vec4(min(layer,vec3(1.5,1.2,2.0)),1.);
  }
`;

export const layerUpdate = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uSource,uVelocity;
  uniform vec2 uTexel;
  uniform float uDt;
  void main(){
    vec2 flow=texture2D(uVelocity,vUv).xy*uTexel*.20;
    float down=texture2D(uSource,vUv-uDt*(flow+vec2(0.,-.016))).r;
    float air=texture2D(uSource,vUv-uDt*(flow+vec2(0.,.045))).g;
    float lift=texture2D(uSource,vUv-uDt*(flow+vec2(0.,.065))).b;
    vec3 blur=(texture2D(uSource,vUv+vec2(uTexel.x,0)).rgb+texture2D(uSource,vUv-vec2(uTexel.x,0)).rgb+
      texture2D(uSource,vUv+vec2(0,uTexel.y)).rgb+texture2D(uSource,vUv-vec2(0,uTexel.y)).rgb)*.25;
    vec3 layer=mix(vec3(down,air,lift),blur,min(uDt*.7,.1));
    layer*=exp(-uDt*vec3(.10,.17,.21));
    layer.gb*=1.-smoothstep(.98,1.,vUv.y);
    gl_FragColor=vec4(layer,1.);
  }
`;

export const particleMotion = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uPositions,uMotion,uVelocity,uLayers;
  uniform vec2 uTexel;
  uniform float uDt,uTime,uAuto,uAspect;
  ${noise}
  void main(){
    vec4 state=texture2D(uPositions,vUv);
    vec4 motion=texture2D(uMotion,vUv);
    vec2 rnd=hash22(vUv*1037.1+9.3);
    vec2 at=clamp(state.xy,vec2(.001),vec2(.999));
    vec3 layers=texture2D(uLayers,at).rgb;
    vec2 flow=texture2D(uVelocity,at).xy*uTexel;
    float lift=min(layers.b,1.6);
    float heavy=max(state.z,min(layers.r,1.))*(1.-min(lift,1.));
    vec2 goal=flow*mix(.68,.42,heavy);
    goal.x+=sin(state.x*uAspect*3.2+uTime*.26)*.0025*uAuto;
    goal.y-=((.010+rnd.x*.020)*state.z+layers.r*.030)*(1.-min(lift,1.));
    goal.y-=(.00010+rnd.x*.00020)*uAuto;
    goal.y+=layers.g*.003*(1.-heavy)+lift*(.046+rnd.x*.024);
    float bed=.025+rnd.y*.135+.045*noise2(vec2(state.x*uAspect*4.5,1.37));
    if(goal.y<0.)goal.y*=smoothstep(0.,.040,state.y-bed);
    if(goal.y>0.)goal.y*=smoothstep(0.,.18,.99-state.y);
    motion.xy=mix(motion.xy,goal,1.-exp(-uDt*(1.9+lift*1.8)));
    if(state.y<=bed+.0002 && motion.y<0.)motion.y=0.;
    motion.xy=clamp(motion.xy,vec2(-.15),vec2(.15));
    float turnover=.15+rnd.y*.14+length(motion.xy)*3.0+heavy*.25+lift*.36;
    motion.z=mix(motion.z,turnover,1.-exp(-uDt*1.5));
    gl_FragColor=vec4(motion.xyz,1.);
  }
`;

export const settlingUpdate = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uPositions,uMotion,uLayers;
  uniform float uDt,uAspect;
  ${noise}
  void main(){
    vec4 state=texture2D(uPositions,vUv);
    vec3 motion=texture2D(uMotion,vUv).xyz;
    vec2 rnd=hash22(vUv*1037.1+9.3);
    vec3 layers=texture2D(uLayers,clamp(state.xy,vec2(.001),vec2(.999))).rgb;
    state.z=1.-(1.-state.z)*exp(-min(layers.r,1.4)*uDt*2.0);
    // Lift releases the same grains from the bed, instead of spawning replacements.
    state.z*=exp(-uDt*(.024+layers.b*5.0));
    float bed=.025+rnd.y*.135+.045*noise2(vec2(state.x*uAspect*4.5,1.37));
    float floorY=min(state.y,bed);
    state.xy+=motion.xy*uDt;
    state.y=max(state.y,floorY);
    state.xy=clamp(state.xy,vec2(-.1),vec2(1.1));
    state.w+=motion.z*uDt*mix(-1.,1.,step(.5,rnd.x));
    gl_FragColor=state;
  }
`;

export const bubbleVertex = /* glsl */ `
  attribute vec3 aSeed;
  uniform sampler2D uLayers;
  uniform float uTime,uPixelRatio;
  varying float vAlpha,vShape;
  void main(){
    float travel=fract(aSeed.y+uTime*(.028+aSeed.z*.021));
    vec2 p=vec2(aSeed.x+sin(travel*5.+aSeed.z*6.28)*.016,.24+travel*.91);
    float air=texture2D(uLayers,clamp(p,vec2(.001),vec2(.999))).g;
    float fade=smoothstep(.25,.46,p.y)*(1.-smoothstep(.92,1.07,p.y));
    vAlpha=(.018+air*.32+step(.92,aSeed.z)*.034)*fade;
    vShape=aSeed.z;
    gl_PointSize=(2.4+pow(aSeed.z,2.)*6.0)*uPixelRatio;
    gl_Position=vec4(p*2.-1.,0.,1.);
  }
`;

export const bubbleFragment = /* glsl */ `
  varying float vAlpha,vShape;
  void main(){
    vec2 p=(gl_PointCoord-.5)*vec2(1.06,.92);
    float r=length(p);
    float rim=exp(-pow((r-.32)/.055,2.));
    float highlight=exp(-dot(p-vec2(-.13,.19),p-vec2(-.13,.19))*95.);
    float haze=exp(-dot(p,p)*16.)*.10;
    gl_FragColor=vec4(.025,.40,1.,(rim*.5+highlight*.7+haze)*vAlpha);
  }
`;
