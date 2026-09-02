const W=800,H=800; const buf=new Uint8ClampedArray(W*H*4);
function fill(h, method){
  const xmin=-100,xmax=100,ymin=-100,ymax=100;
  let i=0;
  for(let py=0;py<H;py++){ const y=ymax-(py+0.5)/H*(ymax-ymin);
    for(let px=0;px<W;px++){ const x=xmin+(px+0.5)/W*(xmax-xmin);
      const zr=h*x, zi=h*y; let qr,qi;
      if(method===0){qr=1+zr;qi=zi;}
      else if(method===1){ // horner: 1+z(1+z/2(1+z/3(1+z/4)))
        let ar=1+zr/4, ai=zi/4; // (1+z/4)
        let tr=(zr*ar-zi*ai)/3, ti=(zr*ai+zi*ar)/3; ar=1+tr; ai=ti;
        tr=(zr*ar-zi*ai)/2; ti=(zr*ai+zi*ar)/2; ar=1+tr; ai=ti;
        tr=zr*ar-zi*ai; ti=zr*ai+zi*ar; qr=1+tr; qi=ti;
      } else { const dr=1-zr, di=-zi, n=dr*dr+di*di; qr=dr/n; qi=-di/n; }
      const inside = qr*qr+qi*qi <= 1;
      buf[i]=inside?60:240; buf[i+1]=inside?120:240; buf[i+2]=inside?220:240; buf[i+3]=255; i+=4;
    }}
}
for (const m of [0,1,2]) { fill(0.03,m); const N=20; const t0=performance.now(); for(let r=0;r<N;r++) fill(0.03+r*0.001,m); const dt=(performance.now()-t0)/N; console.log(`method ${m}: ${dt.toFixed(2)} ms per 800x800 frame`); }
