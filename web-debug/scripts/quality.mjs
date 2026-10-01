// Browser-side observations: no ranking, answer-engine or aesthetic score.
export function contrastRatio(foreground,background) {
  function luminance(rgb) {return rgb.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);}
  if(![foreground,background].every(rgb=>Array.isArray(rgb)&&rgb.length===3&&rgb.every(v=>Number.isFinite(v)&&v>=0&&v<=255)))throw new Error('Contrast needs two opaque RGB triplets (0..255)');
  const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

function seoAudit(indexing) {
  const checks=[];const add=(rule,severity,count,evidence)=>checks.push({rule,severity,count,status:count?'finding':'no-finding',evidence:evidence.slice(0,20)});
  const descriptions=[...document.querySelectorAll('meta[name="description" i]')].map(e=>(e.content||'').trim());
  const canonicals=[...document.querySelectorAll('link[rel~="canonical" i]')].map(e=>{const raw=e.getAttribute('href')??'';try{const u=new URL(raw,document.baseURI);return {url:u.href,valid:!!raw&&['http:','https:'].includes(u.protocol),hasFragment:!!u.hash};}catch{return {url:raw,valid:false};}});
  const robots=[...document.querySelectorAll('meta[name="robots" i],meta[name="googlebot" i],meta[name="bingbot" i]')].map(e=>({agent:e.name.toLowerCase(),directives:e.content}));
  const noindex=robots.filter(e=>/(?:^|[\s,])(noindex|none)(?=$|[\s,])/i.test(e.directives));
  add('missing-title','warning',document.title.trim()?0:1,[]);
  add('description-missing','review',descriptions.some(Boolean)?0:1,[]);
  add('multiple-descriptions','review',descriptions.length>1?1:0,[]);
  add('canonical-missing','review',canonicals.length?0:1,[]);
  add('multiple-canonicals','warning',canonicals.length>1?1:0,[]);
  add('invalid-canonical','warning',canonicals.filter(c=>!c.valid||c.hasFragment).length,canonicals.filter(c=>!c.valid||c.hasFragment));
  if(indexing!=='private')add('noindex-needs-intent-check',indexing==='public'?'warning':'review',noindex.length,noindex);
  const scripts=[...document.querySelectorAll('script[type="application/ld+json" i]')],structured=[];let sampled=scripts.length>50,totalBytes=0;
  for(let index=0;index<Math.min(scripts.length,50);index++) {
    const text=scripts[index].textContent??'';totalBytes+=text.length;
    if(text.length>256000||totalBytes>1000000){sampled=true;structured.push({index,syntaxValid:null,skipped:'size-limit'});continue;}
    try {
      const data=JSON.parse(text),types=new Set(),queue=[data];let visited=0;
      while(queue.length&&visited<5000) {
        const item=queue.pop();visited++;if(!item||typeof item!=='object')continue;
        for(const type of Array.isArray(item['@type'])?item['@type']:[item['@type']])if(typeof type==='string')types.add(type);
        for(const child of Object.values(item))if(child&&typeof child==='object')queue.push(child);
      }
      if(queue.length)sampled=true;
      structured.push({index,syntaxValid:true,types:[...types].slice(0,30),objectOrArray:data!==null&&typeof data==='object'});
    }catch{structured.push({index,syntaxValid:false});}
  }
  add('invalid-json-ld-syntax','warning',structured.filter(s=>s.syntaxValid===false).length,structured.filter(s=>s.syntaxValid===false).map(s=>({scriptIndex:s.index})));
  add('json-ld-non-object','review',structured.filter(s=>s.syntaxValid===true&&!s.objectOrArray).length,[]);
  const headings=[...document.querySelectorAll('h1,h2,h3')].slice(0,60).map(e=>({level:Number(e.tagName[1]),text:(e.innerText||'').trim().slice(0,180)}));
  const links=[...document.querySelectorAll('a[href]')];
  return {url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},indexingIntent:indexing,title:document.title.slice(0,300),descriptions:descriptions.map(s=>s.slice(0,600)),canonicals,robots,headings,structuredData:structured,
    alternateLanguages:[...document.querySelectorAll('link[rel~="alternate"][hreflang]')].slice(0,40).map(e=>({language:e.hreflang,url:e.href})),
    crawlableLinkCount:links.filter(e=>/^https?:/.test(e.href)).length,checks,coverage:{truncated:sampled,mainFrameOnly:true,renderedDOM:true},
    note:'Rendered DOM only. JSON syntax/type inventory is not schema validation or rich-result eligibility. HTTP/robots.txt/crawler access, site-wide duplication and actual indexing are unverified. No rank/AEO score is computed.'};
}
export function seoExpression(indexing='unknown') {
  if(!['public','private','unknown'].includes(indexing))throw new Error('seoAudit indexing must be public, private or unknown');
  return `(${seoAudit.toString()})(${JSON.stringify(indexing)})`;
}

function designAudit(ratio) {
  let computedStyleReads=0;const styleOf=e=>{computedStyleReads++;return getComputedStyle(e);};
  const nodes=[...document.querySelectorAll('h1,h2,h3,p,label,button,input,select,textarea,a,[role=button]')];
  const visible=e=>{const r=e.getBoundingClientRect(),s=styleOf(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
  const selected=[];let truncated=false;for(const node of nodes){if(!visible(node))continue;if(selected.length===500){truncated=true;break;}selected.push(node);}
  const fonts=new Map(),sizes=new Set(),small=[],lowContrast=[],measured=[];let complex=0;
  const identity=e=>e.id?'#'+CSS.escape(e.id):e.tagName.toLowerCase();
  const opaqueRGB=value=>{const m=value.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/);return m&&(m[4]===undefined||Number(m[4])===1)?m.slice(1,4).map(Number):null;};
  for(const e of selected) {
    const s=styleOf(e),r=e.getBoundingClientRect();fonts.set(s.fontFamily,(fonts.get(s.fontFamily)||0)+1);sizes.add(s.fontSize);
    if(e.matches('button,input:not([type=hidden]),select,textarea,[role=button]')&&(r.width<24||r.height<24))small.push({element:identity(e),width:r.width,height:r.height});
    if(![...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()))continue;
    const fg=opaqueRGB(s.color),bg=opaqueRGB(s.backgroundColor);let simple=!!fg&&!!bg;
    for(let a=e;a&&simple;a=a.parentElement) {const c=styleOf(a);if(c.opacity!=='1'||c.filter!=='none'||c.mixBlendMode!=='normal'||c.backgroundImage!=='none'||c.textShadow!=='none'||c.backgroundClip==='text')simple=false;}
    if(!simple){complex++;continue;}
    const contrast=ratio(fg,bg),font=parseFloat(s.fontSize),bold=Number(s.fontWeight)>=700,minimum=(font>=24||(font>=18.6667&&bold))?3:4.5;
    const entry={element:identity(e),ratio:Number(contrast.toFixed(3)),minimum,fontSize:s.fontSize,fontWeight:s.fontWeight};measured.push(entry);
    if(contrast<minimum)lowContrast.push(entry);
  }
  const checks=[{rule:'small-control-candidate',severity:'review',count:small.length,status:small.length?'finding':'no-finding',evidence:small.slice(0,20)},{rule:'simple-text-contrast-candidate',severity:'review',count:lowContrast.length,status:lowContrast.length?'finding':'no-finding',evidence:lowContrast.slice(0,20)}];
  return {url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},typography:{fontFamilies:[...fonts].map(([family,count])=>({family,count})),fontSizes:[...sizes]},contrast:{measured:measured.slice(0,50),measuredCount:measured.length,complexSamplesSkipped:complex},checks,
    coverage:{truncated,scannedElements:selected.length,computedStyleReads,mainFrameOnly:true},
    note:'Design measurements support screenshot review, not an aesthetic score. Contrast samples require an opaque background on the text element and exclude complex effects; they do not prove WCAG compliance. Target-size exceptions, spacing, disabled states and contextual usability require review.'};
}
export const designExpression=`(${designAudit.toString()})(${contrastRatio.toString()})`;
