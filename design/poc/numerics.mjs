// m x'' + c x' + k x = 0  ->  lambda = (-c +- sqrt(c^2 - 4 m k)) / (2m)
const m=10, c=0.1, k=10;
const disc = c*c - 4*m*k;
let lam;
if (disc < 0) lam = [{re:-c/(2*m), im: Math.sqrt(-disc)/(2*m)}, {re:-c/(2*m), im:-Math.sqrt(-disc)/(2*m)}];
else lam = [{re:(-c+Math.sqrt(disc))/(2*m), im:0},{re:(-c-Math.sqrt(disc))/(2*m), im:0}];
console.log('eigenvalues', lam);
// amplification factors
const cmul=(a,b)=>({re:a.re*b.re-a.im*b.im, im:a.re*b.im+a.im*b.re});
const cadd=(a,b)=>({re:a.re+b.re, im:a.im+b.im});
const cabs=a=>Math.hypot(a.re,a.im);
const scale=(a,s)=>({re:a.re*s, im:a.im*s});
function qEuler(z){return cadd({re:1,im:0},z);}
function qRK4(z){const z2=cmul(z,z),z3=cmul(z2,z),z4=cmul(z3,z);return cadd(cadd(cadd(cadd({re:1,im:0},z),scale(z2,1/2)),scale(z3,1/6)),scale(z4,1/24));}
function qImp(z){const d=cadd({re:1,im:0},scale(z,-1)); const n=d.re*d.re+d.im*d.im; return {re:d.re/n, im:-d.im/n};}
for (const h of [1/30, 1/60, 0.2]) {
  const z=scale(lam[0],h);
  console.log(`h=${h.toFixed(4)} hλ=(${z.re.toFixed(5)},${z.im.toFixed(5)}) |Euler|=${cabs(qEuler(z)).toFixed(6)} |RK4|=${cabs(qRK4(z)).toFixed(6)} |ImpEuler|=${cabs(qImp(z)).toFixed(6)}`);
}
// simulate: state (x,v), f = (v, -(c v + k x)/m)
const f=(x,v)=>[v, -(c*v+k*x)/m];
function euler(x,v,h){const [dx,dv]=f(x,v);return [x+h*dx,v+h*dv];}
function rk4(x,v,h){
  const k1=f(x,v); const k2=f(x+h/2*k1[0],v+h/2*k1[1]); const k3=f(x+h/2*k2[0],v+h/2*k2[1]); const k4=f(x+h*k3[0],v+h*k3[1]);
  return [x+h/6*(k1[0]+2*k2[0]+2*k3[0]+k4[0]), v+h/6*(k1[1]+2*k2[1]+2*k3[1]+k4[1])];
}
function semi(x,v,h){const a=-(c*v+k*x)/m; v=v+h*a; return [x+h*v, v];}
function implicit(x,v,h){ // solve (I - hA) y = s, A=[[0,1],[-k/m,-c/m]]
  const a=0,b=1,cc=-k/m,d=-c/m;
  const M00=1-h*a, M01=-h*b, M10=-h*cc, M11=1-h*d; const det=M00*M11-M01*M10;
  return [( M11*x - M01*v)/det, (-M10*x + M00*v)/det];
}
function exact(t,x0,v0){ // underdamped
  const a=-c/(2*m), w=Math.sqrt(4*m*k-c*c)/(2*m);
  const A=x0, B=(v0-a*x0)/w;
  return Math.exp(a*t)*(A*Math.cos(w*t)+B*Math.sin(w*t));
}
for (const [name,step] of [['euler',euler],['rk4',rk4],['semi-implicit',semi],['implicit',implicit]]) {
  for (const h of [1/30,1/60]) {
    let x=1,v=0,t=0; const out=[];
    for (let s=0;s<=60/h;s++){ if (Math.abs(s*h - Math.round(s*h))<1e-9 && Math.round(s*h)%10===0) out.push(`t=${Math.round(s*h)} x=${x.toExponential(3)} exact=${exact(s*h,1,0).toFixed(4)}`); [x,v]=step(x,v,h); }
    console.log(name,'h='+h.toFixed(4)); console.log('  '+out.join('\n  '));
  }
}
