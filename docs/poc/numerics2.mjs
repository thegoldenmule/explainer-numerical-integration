function run(m,c,k,h,T,label){
  const f=(x,v)=>[v, -(c*v+k*x)/m];
  const a=-c/(2*m), w=Math.sqrt(Math.max(4*m*k-c*c,0))/(2*m);
  const exact=t=>Math.exp(a*t)*(Math.cos(w*t)-(a/w)*Math.sin(w*t)); // x0=1,v0=0
  const rho=Math.hypot(1+h*a, h*w);
  console.log(`\n== ${label}: m=${m} c=${c} k=${k} h=${h.toFixed(4)}  λ=${a.toFixed(4)}±${w.toFixed(4)}i  |1+hλ|=${rho.toFixed(5)}  Euler doubling time=${(h*Math.LN2/Math.log(rho)).toFixed(1)}s`);
  const steps={
    euler:(x,v)=>{const [dx,dv]=f(x,v);return [x+h*dx,v+h*dv];},
    rk4:(x,v)=>{const k1=f(x,v),k2=f(x+h/2*k1[0],v+h/2*k1[1]),k3=f(x+h/2*k2[0],v+h/2*k2[1]),k4=f(x+h*k3[0],v+h*k3[1]);return [x+h/6*(k1[0]+2*k2[0]+2*k3[0]+k4[0]),v+h/6*(k1[1]+2*k2[1]+2*k3[1]+k4[1])];},
    semi:(x,v)=>{v+=h*f(x,v)[1];return [x+h*v,v];},
    implicit:(x,v)=>{const M01=-h,M10=h*k/m,M11=1+h*c/m,det=M11-M01*M10;return [(M11*x-M01*v)/det,(-M10*x+v)/det];},
  };
  for (const [name,step] of Object.entries(steps)) {
    let x=1,v=0,mx=0; const out=[];
    for(let s=0;s*h<=T+1e-9;s++){ if(Math.abs(s*h/(T/6)-Math.round(s*h/(T/6)))<1e-6) out.push(`t=${(s*h).toFixed(0)}:${x.toExponential(2)}`); [x,v]=step(x,v); }
    console.log(`  ${name.padEnd(9)} ${out.join('  ')}`);
  }
  // Störmer–Verlet, position form: x_{n+1} = 2x_n - x_{n-1} + h^2 a(x_n, v_n), v_n ≈ (x_{n+1}-x_{n-1})/(2h) lagged -> use v_n ≈ (x_n - x_{n-1})/h for drag
  { let xm=exact(-h), x=1, out=[]; // start with exact x_{-1}
    for(let s=0;s*h<=T+1e-9;s++){ if(Math.abs(s*h/(T/6)-Math.round(s*h/(T/6)))<1e-6) out.push(`t=${(s*h).toFixed(0)}:${x.toExponential(2)}`); const v=(x-xm)/h; const xn=2*x-xm+h*h*(-(c*v+k*x)/m); xm=x; x=xn; }
    console.log(`  verlet    ${out.join('  ')}`); }
  { let out=[]; for(let s=0;s*h<=T+1e-9;s++){ if(Math.abs(s*h/(T/6)-Math.round(s*h/(T/6)))<1e-6) out.push(`t=${(s*h).toFixed(0)}:${exact(s*h).toExponential(2)}`);} console.log(`  exact     ${out.join('  ')}`); }
}
run(10,0.1,10,1/30,600,'essay params, 10 minutes');
run(10,0.1,10,1/60,600,'essay params, h=1/60, 10 minutes');
run(1,0.1,100,1/30,12,'demo-friendly k/m=100');
run(1,0.1,100,0.2,4,'k/m=100, h=0.2 (RK4 should also fail: hλ≈2i)');
