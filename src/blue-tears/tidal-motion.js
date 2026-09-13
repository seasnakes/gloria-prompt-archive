export const tidalMotion = /* glsl */ `
  uniform float uTime,uAspect,uSwell,uAuto;
  uniform vec2 uTilt;
  vec2 sheetDisplacement(vec2 p){
    float a=.6+uSwell*.95;
    vec2 waves=vec2(
      sin(p.y*2.5+p.x*.55-uTime*.67)*.070+
        sin(p.y*1.15-p.x*.7+uTime*.37+1.7)*.018,
      sin(p.x*2.0-p.y*.40+uTime*.53+1.2)*.052+
        cos(p.y*1.5+p.x*.60-uTime*.36)*.016);
    vec2 tiltShear=vec2(uTilt.x*(.11+.035*p.y),uTilt.y*(.085+.024*p.x));
    return waves*a*uAuto+tiltShear;
  }
  vec2 materialAt(vec2 screen){
    vec2 q=screen;
    for(int i=0;i<4;i++)q=screen-sheetDisplacement(q);
    return q;
  }
  vec2 sheetSlope(vec2 p){
    float a=.6+uSwell*.95;
    float w1=p.y*2.5+p.x*.55-uTime*.67;
    float w2=p.x*2.-p.y*.4+uTime*.53+1.2;
    return vec2(.11*cos(w1)+.27*cos(w2),.30*cos(w1)-.09*cos(w2))*a*uAuto+uTilt*.57;
  }
  vec2 sheetDrift(vec2 p){
    return vec2(-.070*.67*cos(p.y*2.5+p.x*.55-uTime*.67),
      .052*.53*cos(p.x*2.-p.y*.4+uTime*.53+1.2))*(.6+uSwell*.95)*uAuto+uTilt*.025;
  }
`;

