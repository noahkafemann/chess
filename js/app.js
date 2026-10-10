(function(){
  "use strict";
  var API="https://api.chess.com/pub";
  var MODES=["rapid","blitz","bullet"];
  var MA={rapid:"chess_rapid",blitz:"chess_blitz",bullet:"chess_bullet"};
  var ML={rapid:"Rapid",blitz:"Blitz",bullet:"Bullet"};
  var NF=new Intl.NumberFormat("de-DE");
  var CIRC=2*Math.PI*24;
  var uid=0;

  var form=document.getElementById("searchForm");
  var i1=document.getElementById("username1");
  var i2=document.getElementById("username2");
  var g2=document.getElementById("secondInputGroup");
  var btn=document.getElementById("submitBtn");
  var lbl=btn.querySelector(".btn-label");
  var st=document.getElementById("status");
  var res=document.getElementById("results");
  var mS=document.getElementById("modeSingle");
  var mC=document.getElementById("modeCompare");

  var cmp=false;

  function set(m,t){ st.textContent=m||""; st.className="status"+(t?" status--"+t:""); }
  function esc(v){ return String(v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function ok(n){ return /^[A-Za-z0-9_-]{3,64}$/.test(n); }
  function ld(b){ btn.disabled=b; btn.classList.toggle("loading",b); lbl.textContent=b?"Lade…":(cmp?"Vergleichen":"Analysieren"); }

  function j(u){
    return fetch(u).then(function(r){
      if(r.status===404) throw {kind:"nf"};
      if(r.status===429) throw {kind:"rl"};
      if(!r.ok) throw {kind:"api",s:r.status};
      return r.json();
    }).catch(function(e){
      if(e&&e.kind) return Promise.reject(e);
      throw {kind:"net"};
    });
  }

  function get(n){
    var x=n.trim().toLowerCase();
    var b=API+"/player/"+encodeURIComponent(x);
    return j(b).then(function(p){
      return j(b+"/stats").then(function(s){ return build(p,s); });
    });
  }

  function ds(t){ return (Date.now()/1000-t)/86400; }

  function build(p,s){
    var w=0,l=0,d=0,tot=0,last=0;
    var mo={};
    for(var i=0;i<MODES.length;i++){
      var m=MODES[i];
      var st=s&&s[MA[m]]||{};
      var rec=st.record||{};
      var la=st.last||{};
      var be=st.best||{};
      var ww=rec.win||0,ll=rec.loss||0,dd=rec.draw||0;
      mo[m]={r:la.rating!=null?la.rating:null,be:be.rating!=null?be.rating:null,g:ww+ll+dd,w:ww,l:ll,d:dd};
      w+=ww;l+=ll;d+=dd;tot+=ww+ll+dd;
      if(la.date&&la.date>last) last=la.date;
    }
    var av=p.avatar||null;
    if(av&&av[0]==="/") av="https://www.chess.com"+av;
    var cc=null;
    if(p.country){ var mc=/\/country\/([A-Za-z]{2})$/.exec(p.country); if(mc) cc=mc[1]; }
    var fid=s&&s.fide!=null?s.fide:null;
    var ta=null;
    if(s&&s.tactics&&s.tactics.highest&&s.tactics.highest.rating!=null) ta=s.tactics.highest.rating;
    return {u:p.username||"",n:p.name||"",t:p.title||"",av:av,cc:cc,loc:p.location||"",join:p.joined!=null?p.joined:null,lo:p.last_online!=null?p.last_online:null,st:p.status,verified:!!p.verified,league:p.league||"",fid:fid,ta:ta,mo:mo,w:w,l:l,d:d,tot:tot,last:last};
  }

  function score(p){
    var best=0;
    for(var i=0;i<MODES.length;i++){ var v=p.mo[MODES[i]].r; if(v&&v>best) best=v; }
    var rp=Math.min(1,Math.max(0,(best-400)/2000))*60;
    var da=p.last?ds(p.last):365;
    var ap=25*Math.max(0,1-da/365);
    var ep=15*Math.min(1,Math.log10(1+p.tot)/Math.log10(10001));
    return Math.round(rp+ap+ep);
  }

  function dna(p){
    var tg=[];
    var rt=[];
    for(var i=0;i<MODES.length;i++){ var m=MODES[i],x=p.mo[m]; if(x.r!=null) rt.push({m:m,r:x.r,g:x.g}); }
    if(rt.length){
      rt.sort(function(a,b){return b.r-a.r;});
      var top=rt[0];
      if(top.m==="bullet"&&top.g>=30) tg.push("⚡ Schnellspieler");
      if(top.m==="blitz"&&top.g>=30) tg.push("🔥 Blitz-Spieler");
      if(top.m==="rapid"&&top.g>=30) tg.push("♟️ Rapid-Spezialist");
    }
    if(p.tot>=1000) tg.push("🧠 Vielspieler");
    if(p.last&&ds(p.last)<=30) tg.push("📈 Aktiv");
    if(p.fid) tg.push("🏆 FIDE-Spieler");
    if(p.ta!=null&&p.ta>=500) tg.push("🧩 Taktik-Profi");
    if(!tg.length) tg.push("🌱 Einsteiger");
    return tg;
  }

  function flag(c){ if(!c||c.length!==2)return""; var s=""; for(var i=0;i<2;i++){ var cp=0x1F1E6+(c.toUpperCase().charCodeAt(i)-65); if(cp>=0x1F1E6&&cp<=0x1F1FF) s+=String.fromCodePoint(cp);} return s; }

  function age(j){ if(!j)return null; var th=new Date(j*1000),nw=new Date(); var y=nw.getFullYear()-th.getFullYear(),mo=nw.getMonth()-th.getMonth(); if(mo<0){y--;mo+=12;} if(y<0){y=0;mo=0;} var pt=[]; if(y)pt.push(y===1?"1 Jahr":y+" Jahre"); if(mo&&y<10)pt.push(mo===1?"1 Monat":mo+" Monate"); return "seit "+th.toLocaleDateString("de-DE",{month:"long",year:"numeric"})+(pt.length?" · "+pt.join(" "):""); }

  function timeAgo(ts){ if(!ts)return null; var s=Math.floor(Date.now()/1000-ts); if(s<60)return "gerade eben"; var m=Math.floor(s/60); if(m<60)return "vor "+m+(m===1?" Minute":" Minuten"); var h=Math.floor(m/60); if(h<24)return "vor "+h+(h===1?" Stunde":" Stunden"); var d=Math.floor(h/24); if(d<30)return "vor "+d+(d===1?" Tag":" Tagen"); var mo=Math.floor(d/30); if(mo<12)return "vor "+mo+(m===1?" Monat":" Monaten"); var y=Math.floor(mo/12); return "vor "+y+(y===1?" Jahr":" Jahren"); }

  function card(p){
    var nm=p.n?esc(p.n):esc(p.u);
    var tt=p.t?"<span class='player-title'>"+esc(p.t)+"</span>":"";
    var wr=p.w+p.l?Math.round(p.w/(p.w+p.l)*100):null;
    var tgs=""; var dd=dna(p); for(var i=0;i<dd.length;i++){ tgs+="<span class='dna-tag' style='animation-delay:"+(i*70)+"ms'>"+esc(dd[i])+"</span>"; }
    var scv=score(p);
    var off=CIRC*(1-scv/100);
    var av=p.av?"<img class='avatar' src='"+esc(p.av)+"' alt='' onerror=\"this.remove()\">":"<div class='avatar avatar-fallback'>"+(nm[0]||"?").toUpperCase()+"</div>";
    var meta=[]; var pl=p.loc||p.cc; if(pl) meta.push("<span>"+(flag(p.cc)+" "+esc(pl)).trim()+"</span>"); if(p.fol!=null) meta.push("<span>👥 "+NF.format(p.fol)+" Follower</span>"); var ag=age(p.join); if(ag) meta.push("<span>📅 "+esc(ag)+"</span>"); var ta=timeAgo(p.lo); if(ta) meta.push("<span>🕒 "+esc(ta)+" online</span>"); if(p.league) meta.push("<span>🏅 "+esc(p.league)+"</span>");
    var bst=0; for(var i=0;i<MODES.length;i++){ var v=p.mo[MODES[i]].be; if(v&&v>bst) bst=v; }
    var rid="sg"+(++uid);
    return "<article class='player-card'><header class='card-head'>"+av+"<div class='player-id'><div class='player-name'>"+nm+tt+"</div><div class='player-meta'>@"+esc(p.u)+"</div>"+(meta.length?"<div class='player-meta'>"+meta.join("")+"</div>":"")+"</div></header><div class='card-body'><div class='ratings'>"+MODES.map(function(m){return "<div class='rating-box'><div class='rating-label'>"+ML[m]+"</div><div class='rating-value "+m+"' data-count='"+(p.mo[m].r!=null?p.mo[m].r:"0")+"'>"+(p.mo[m].r!=null?p.mo[m].r:"–")+"</div><div class='rating-sub'>"+(p.mo[m].be!=null?"Best: "+NF.format(p.mo[m].be):"keine Partien")+"</div></div>";}).join("")+"</div><div class='stat-grid'><div class='stat-cell'><div class='k'>Partien</div><div class='v'>"+NF.format(p.tot)+"</div></div><div class='stat-cell'><div class='k'>Siege</div><div class='v win'>"+NF.format(p.w)+"</div></div><div class='stat-cell'><div class='k'>Niederlagen</div><div class='v loss'>"+NF.format(p.l)+"</div></div><div class='stat-cell'><div class='k'>Remis</div><div class='v draw'>"+NF.format(p.d)+"</div></div><div class='stat-cell'><div class='k'>Siegquote</div><div class='v'>"+(wr!=null?wr:"–")+"%</div></div><div class='stat-cell'><div class='k'>Bestes Rating</div><div class='v'>"+(bst||"–")+"</div></div></div><div class='dna'><h3>Spieler-DNA</h3><div class='dna-tags'>"+tgs+"</div></div><div class='score-row'><div class='score-ring'><svg width='56' height='56'><circle cx='28' cy='28' r='24' fill='none' stroke-width='5' class='track'/><circle cx='28' cy='28' r='24' fill='none' stroke='url(#"+rid+")' stroke-width='5' stroke-dasharray='"+CIRC.toFixed(1)+"' stroke-dashoffset='"+CIRC.toFixed(1)+"' class='bar' data-target='"+off.toFixed(1)+"'/><defs><linearGradient id='"+rid+"'><stop offset='0%' stop-color='#7c5cff'/><stop offset='100%' stop-color='#4ade80'/></linearGradient></defs></svg><div class='score-num'>"+scv+"</div></div><div class='score-text'><strong>ChessMatch-Statistik-Score: "+scv+" / 100</strong>Nur eigener Statistik-Score, keine offizielle Chess.com-Wertung.</div></div></div></article>";
  }

  function compare(a,b){
    var rows=[["Rapid-Rating",a.mo.rapid.r,b.mo.rapid.r,true],["Blitz-Rating",a.mo.blitz.r,b.mo.blitz.r,true],["Bullet-Rating",a.mo.bullet.r,b.mo.bullet.r,true],["Partien",a.tot,b.tot,true],["Siege",a.wins,b.wins,true],["Niederlagen",a.losses,b.losses,false],["Remis",a.draws,b.draws,true]];
    var al=0,bl=0; var bd="";
    for(var i=0;i<rows.length;i++){
      var r=rows[i]; var ca="tie",cb="tie";
      if(r[1]==null&&r[2]==null){ ca="tie";cb="tie"; }
      else if(r[1]==null){ cb="leader";bl++; }
      else if(r[2]==null){ ca="leader";al++; }
      else if(r[1]===r[2]){ ca="tie";cb="tie"; }
      else if(r[3]?(r[1]>r[2]):(r[1]<r[2])){ ca="leader";al++; } else { cb="leader";bl++; }
      bd+="<tr><td>"+esc(r[0])+"</td><td class='"+ca+"'>"+(r[1]==null?"–":NF.format(r[1]))+"</td><td class='"+cb+"'>"+(r[2]==null?"–":NF.format(r[2]))+"</td></tr>";
    }
    var vd=al===bl?"Gleichstand: beide führen in "+al+" von "+rows.length+" Kategorien.":(al>bl?"<strong>"+esc(a.u)+"</strong> führt in "+al+" von "+rows.length+" Kategorien.":"<strong>"+esc(b.u)+"</strong> führt in "+bl+" von "+rows.length+" Kategorien.");
    return "<div class='compare-table-wrap'><table class='compare-table'><thead><tr><th>Kategorie</th><th>"+esc(a.u)+"</th><th>"+esc(b.u)+"</th></tr></thead><tbody>"+bd+"</tbody></table></div><p class='verdict'>"+vd+"</p><p class='footnote'>▲ = liegt vorne · Bei Niederlagen: weniger ist besser.</p>";
  }

  function anim(root){
    var els=root.querySelectorAll("[data-count]");
    for(var i=0;i<els.length;i++){
      var el=els[i],tgt=parseFloat(el.getAttribute("data-count"));
      if(isNaN(tgt)||tgt===0){ el.textContent=tgt===0?"0":"–"; continue; }
      var st=performance.now(),dur=700;
      (function(elv,tt,ss,dd){
        function tick(n){ var p=Math.min(1,(n-ss)/dd); var e=1-Math.pow(1-p,3); elv.textContent=NF.format(Math.round(tt*e)); if(p<1) requestAnimationFrame(tick); }
        requestAnimationFrame(tick);
      })(el,tgt,st,dur);
    }
    var bars=root.querySelectorAll(".bar");
    for(var i=0;i<bars.length;i++){
      var b=bars[i],tg=parseFloat(b.getAttribute("data-target"));
      (function(bv,tt){
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ bv.style.strokeDashoffset=tt; }); });
      })(b,tg);
    }
  }

  function go(){
    var n1=i1.value.trim(),n2=i2.value.trim();
    if(!n1||(cmp&&!n2)){ set(cmp?"Bitte zwei Benutzernamen eingeben.":"Bitte einen Benutzernamen eingeben.","error"); return; }
    if(!ok(n1)||(cmp&&!ok(n2))){ set("Ungültiger Benutzername.","error"); return; }
    ld(true); set("Lade Daten von Chess.com …","info");
    if(!cmp){
      get(n1).then(function(p){
        res.innerHTML=card(p);
        if(p.st==="closed") set("⚠️ Account geschlossen – letzter öffentlicher Datenstand.","info"); else set("");
        anim(res); ld(false);
      }).catch(function(e){
        ld(false);
        if(e.kind==="nf") set("Benutzername nicht gefunden.","error");
        else if(e.kind==="rl") set("Zu viele Anfragen. Bitte kurz warten.","error");
        else if(e.kind==="net") set("Netzwerkfehler. Bitte die Seite über http://localhost aufrufen (nicht file://). Prüfe Netzwerk oder CORS.","error");
        else set("API-Fehler.","error");
      });
    }else{
      get(n1).then(function(a){
        get(n2).then(function(b){
          res.innerHTML=card(a)+card(b)+compare(a,b);
          set(""); anim(res); ld(false);
        }).catch(function(e){
          ld(false);
          if(e.kind==="nf") set("Benutzer nicht gefunden.","error");
          else if(e.kind==="rl") set("Zu viele Anfragen.","error");
          else if(e.kind==="net") set("Netzwerkfehler. Bitte über http://localhost aufrufen.","error");
          else set("API-Fehler.","error");
        });
      }).catch(function(e){
        ld(false);
        if(e.kind==="nf") set("Benutzer nicht gefunden.","error");
        else if(e.kind==="rl") set("Zu viele Anfragen.","error");
        else if(e.kind==="net") set("Netzwerkfehler. Bitte über http://localhost aufrufen.","error");
        else set("API-Fehler.","error");
      });
    }
  }

  mS.addEventListener("click",function(){ cmp=false; mS.classList.add("active"); mC.classList.remove("active"); mS.setAttribute("aria-selected","true"); mC.setAttribute("aria-selected","false"); g2.classList.add("input-group--hidden"); ld(false); set(""); });
  mC.addEventListener("click",function(){ cmp=true; mC.classList.add("active"); mS.classList.remove("active"); mC.setAttribute("aria-selected","true"); mS.setAttribute("aria-selected","false"); g2.classList.remove("input-group--hidden"); ld(false); set(""); });
  form.addEventListener("submit",function(e){ e.preventDefault(); go(); });

  res.innerHTML="<div class='empty-hint'>Gib einen Chess.com-Benutzernamen ein und klicke auf <strong>Analysieren</strong>, um die Spieler-Karte zu erstellen.</div>";
})();
