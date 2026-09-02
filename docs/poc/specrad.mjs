// semi-implicit Euler update: v' = (1-hc/m)v - (hk/m)x ; x' = x + h v'
function rho(m,c,k,h){
  const a=1-h*c/m, b=h*k/m;
  const M=[[1-h*b, h*a],[-b, a]];            // [x',v'] = M [x,v]
  const T=M[0][0]+M[1][1], D=M[0][0]*M[1][1]-M[0][1]*M[1][0], disc=T*T-4*D;
  return disc<0 ? Math.sqrt(D) : Math.max(Math.abs((T+Math.sqrt(disc))/2), Math.abs((T-Math.sqrt(disc))/2));
}
for (const [m,c,k,h] of [[10,0.1,10,1/30],[1,0.1,100,1/30],[1,0.1,100,0.2],[1,0.1,100,0.19],[1,0.1,100,0.21]])
  console.log(`m=${m} c=${c} k=${k} h=${h.toFixed(3)} hω=${(h*Math.sqrt(k/m)).toFixed(3)}  ρ(semi-implicit)=${rho(m,c,k,h).toFixed(5)} ${rho(m,c,k,h)<=1?'stable':'UNSTABLE'}`);
