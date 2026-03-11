import { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ═══ CONSTANTS ═══ */
const FILE_TYPES = {
  "application/pdf":{ label:"PDF", icon:"📄", color:"#EF4444", bg:"#FEF2F2" },
  "image/jpeg":     { label:"JPG", icon:"🖼️", color:"#10B981", bg:"#ECFDF5" },
  "image/png":      { label:"PNG", icon:"🖼️", color:"#10B981", bg:"#ECFDF5" },
  "image/gif":      { label:"GIF", icon:"🖼️", color:"#10B981", bg:"#ECFDF5" },
  "image/webp":     { label:"WEBP",icon:"🖼️", color:"#10B981", bg:"#ECFDF5" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":{ label:"DOCX",icon:"📝",color:"#3B82F6",bg:"#EFF6FF" },
  "application/msword":{ label:"DOC",icon:"📝",color:"#3B82F6",bg:"#EFF6FF" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":{ label:"XLSX",icon:"📊",color:"#22C55E",bg:"#F0FDF4" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":{ label:"PPTX",icon:"📋",color:"#F97316",bg:"#FFF7ED" },
  "text/plain":{ label:"TXT",icon:"📃",color:"#6B7280",bg:"#F9FAFB" },
};
const FOLDER_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4","#F97316"];
const uid = () => Math.random().toString(36).slice(2,10);
const fmtSize = b => b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";
const fmtDate = t => { const d=new Date(t); const now=new Date(); const diff=now-d; if(diff<60000) return "刚刚"; if(diff<3600000) return Math.floor(diff/60000)+"分钟前"; if(diff<86400000) return Math.floor(diff/3600000)+"小时前"; return d.toLocaleDateString("zh-CN",{month:"numeric",day:"numeric"}); };

/* ═══ PDF.JS ═══ */
async function loadPdfJs() {
  if(window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}
async function renderPdf(dataUrl) {
  const lib=await loadPdfJs();
  const bin=atob(dataUrl.split(",")[1]); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  const pdf=await lib.getDocument({data:arr}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    const pg=await pdf.getPage(i);
    const vp0=pg.getViewport({scale:1});
    const scale=340/vp0.width;
    const vp=pg.getViewport({scale});
    const c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height;
    await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
    pages.push({url:c.toDataURL("image/jpeg",0.88),w:vp.width,h:vp.height});
  }
  return pages;
}

/* ═══ FLIP READER (full-screen overlay inside phone) ═══ */
function FlipReader({doc,pages,onClose}) {
  const [sp,setSp]=useState(0);
  const [flipping,setFlipping]=useState(null);
  const total=pages.length;
  function flip(dir){ if(flipping) return; if(dir==="fwd"&&sp+1>=total) return; if(dir==="bck"&&sp<=0) return; setFlipping(dir); setTimeout(()=>{ setSp(s=>dir==="fwd"?s+2:s-2); setFlipping(null); },700); }
  useEffect(()=>{ const h=e=>{ if(e.key==="ArrowRight") flip("fwd"); if(e.key==="ArrowLeft") flip("bck"); if(e.key==="Escape") onClose(); }; window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h); });
  const pH=Math.min(440,360*(pages[0]?.h||1.414)/(pages[0]?.w||1));
  const pW=340;
  const Pg=({idx,side,radius})=>{
    if(idx<0||idx>=total) return <div style={{width:"100%",height:"100%",background:side==="L"?"#e8ddd0":"#f0e9e0",borderRadius:radius}}/>;
    return <img src={pages[idx].url} alt="" style={{width:"100%",height:"100%",objectFit:"contain",borderRadius:radius,background:"#faf8f5",display:"block"}}/>;
  };
  const ls=flipping==="fwd"?sp:flipping==="bck"?sp-2:sp;
  const rs=flipping==="fwd"?sp+2:flipping==="bck"?sp+1:sp+1;
  const ffIdx=flipping==="fwd"?sp+1:sp-1;
  const fbIdx=flipping==="fwd"?sp+2:sp-2;
  return (
    <div style={{position:"absolute",inset:0,zIndex:200,background:"#0d0b08",display:"flex",flexDirection:"column",borderRadius:"inherit"}}>
      <div style={{height:52,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",width:32,height:32,borderRadius:10,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <span style={{flex:1,fontSize:13,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</span>
        <span style={{color:"#c9a96e",fontSize:11,fontFamily:"monospace"}}>{Math.min(sp+1,total)}/{total}</span>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",perspective:"2000px"}}>
        <div style={{position:"relative",filter:"drop-shadow(0 20px 40px rgba(0,0,0,0.9))"}}>
          <div style={{position:"relative",width:pW,height:pH,display:"flex",transformStyle:"preserve-3d"}}>
            <div style={{position:"absolute",left:"calc(50% - 4px)",top:0,width:8,height:"100%",zIndex:6,background:"linear-gradient(90deg,#2a1e12,#6b5030,#2a1e12)"}}/>
            <div style={{width:"50%",height:"100%",overflow:"hidden",borderRadius:"10px 0 0 10px"}}><Pg idx={ls} side="L" radius="10px 0 0 10px"/></div>
            <div style={{width:"50%",height:"100%",overflow:"hidden",borderRadius:"0 10px 10px 0"}}><Pg idx={rs} side="R" radius="0 10px 10px 0"/></div>
            {flipping&&(
              <div style={{position:"absolute",top:0,left:flipping==="fwd"?"50%":"0",width:"50%",height:"100%",transformStyle:"preserve-3d",transformOrigin:flipping==="fwd"?"left center":"right center",transform:flipping==="fwd"?"rotateY(-180deg)":"rotateY(180deg)",transition:"transform 0.7s cubic-bezier(0.45,0.05,0.55,0.95)",zIndex:8}}>
                <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",overflow:"hidden",borderRadius:flipping==="fwd"?"0 10px 10px 0":"10px 0 0 10px"}}><Pg idx={ffIdx} side={flipping==="fwd"?"R":"L"} radius={flipping==="fwd"?"0 10px 10px 0":"10px 0 0 10px"}/><div style={{position:"absolute",inset:0,background:flipping==="fwd"?"linear-gradient(95deg,rgba(0,0,0,0.2) 0%,transparent 30%)":"linear-gradient(265deg,rgba(0,0,0,0.2) 0%,transparent 30%)",pointerEvents:"none"}}/></div>
                <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",transform:"rotateY(180deg)",overflow:"hidden",borderRadius:flipping==="fwd"?"10px 0 0 10px":"0 10px 10px 0"}}><Pg idx={fbIdx} side={flipping==="fwd"?"L":"R"} radius={flipping==="fwd"?"10px 0 0 10px":"0 10px 10px 0"}/></div>
              </div>
            )}
          </div>
          <div style={{position:"absolute",bottom:-14,left:"10%",right:"10%",height:20,background:"radial-gradient(ellipse,rgba(0,0,0,0.6) 0%,transparent 70%)",filter:"blur(8px)"}}/>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24,padding:"16px 0 20px",flexShrink:0}}>
        {[["bck","←",sp>0],["fwd","→",sp+1<total]].map(([dir,label,can])=>(
          <button key={dir} onClick={()=>flip(dir)} disabled={!can||!!flipping} style={{width:52,height:52,borderRadius:"50%",border:"1.5px solid",background:can&&!flipping?"rgba(201,169,110,0.15)":"rgba(255,255,255,0.03)",color:can&&!flipping?"#c9a96e":"rgba(255,255,255,0.15)",borderColor:can&&!flipping?"rgba(201,169,110,0.4)":"rgba(255,255,255,0.06)",fontWeight:800,fontSize:18,cursor:can&&!flipping?"pointer":"default"}}>{label}</button>
        ))}
      </div>
      <div style={{textAlign:"center",paddingBottom:12,color:"rgba(255,255,255,0.2)",fontSize:10}}>左右滑动 · 键盘 ← → · ESC退出</div>
    </div>
  );
}

/* ═══ ACTION SHEET ═══ */
function ActionSheet({title,items,onClose}) {
  return (
    <div onClick={onClose} style={{position:"absolute",inset:0,zIndex:150,background:"rgba(0,0,0,0.5)",display:"flex",flexDirection:"column",justifyContent:"flex-end",borderRadius:"inherit"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#F2F2F7",borderRadius:"18px 18px 0 0",paddingBottom:8}}>
        {title&&<div style={{padding:"16px 20px 10px",fontSize:12,color:"#8E8E93",textAlign:"center",fontWeight:500}}>{title}</div>}
        {items.map((item,i)=>(
          <div key={i}>
            {i>0&&<div style={{height:0.5,background:"rgba(0,0,0,0.1)",margin:"0 20px"}}/>}
            <div onClick={()=>{ item.action(); onClose(); }}
              style={{padding:"16px 20px",textAlign:"center",fontSize:16,color:item.destructive?"#FF3B30":item.color||"#007AFF",cursor:"pointer",fontWeight:item.bold?600:400,background:"#fff",marginTop:i===0?0.5:0}}>
              {item.icon&&<span style={{marginRight:8}}>{item.icon}</span>}{item.label}
            </div>
          </div>
        ))}
        <div style={{height:8,background:"#F2F2F7"}}/>
        <div onClick={onClose} style={{padding:"16px 20px",textAlign:"center",fontSize:16,color:"#007AFF",cursor:"pointer",fontWeight:600,background:"#fff",borderRadius:14,margin:"0 8px 4px"}}>取消</div>
      </div>
    </div>
  );
}

/* ═══ MODAL SHEET ═══ */
function ModalSheet({title,onClose,children}) {
  return (
    <div onClick={onClose} style={{position:"absolute",inset:0,zIndex:150,background:"rgba(0,0,0,0.5)",display:"flex",flexDirection:"column",justifyContent:"flex-end",borderRadius:"inherit"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"18px 18px 0 0",maxHeight:"75%",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{width:36,height:4,background:"#E5E5EA",borderRadius:2,margin:"0 auto 12px"}}/>
        </div>
        <div style={{padding:"0 20px",fontFamily:"'PingFang SC',sans-serif",fontWeight:600,fontSize:17,color:"#1C1C1E",marginBottom:16}}>{title}</div>
        <div style={{flex:1,overflowY:"auto",padding:"0 20px 24px"}}>{children}</div>
      </div>
    </div>
  );
}

/* ═══ SHARE MODAL ═══ */
function ShareModal({target,files,onClose}) {
  const [status,setStatus]=useState("idle");
  const [link,setLink]=useState("");
  const [copied,setCopied]=useState(false);
  const [expiry,setExpiry]=useState("7d");
  const isFolder=target.type==="folder";
  const folderFiles=isFolder?files.filter(f=>f.folderId===target.data.id):[];

  async function generate(){
    setStatus("saving");
    try{
      const code=uid();
      let payload;
      if(isFolder){ payload=JSON.stringify({shareType:"folder",folderName:target.data.name,folderColor:target.data.color,files:folderFiles.map(f=>({id:f.id,name:f.name,type:f.type,size:f.size,dataUrl:f.dataUrl,uploadedAt:f.uploadedAt})),sharedAt:Date.now(),expiry}); }
      else{ payload=JSON.stringify({shareType:"file",name:target.data.name,type:target.data.type,size:target.data.size,dataUrl:target.data.dataUrl,uploadedAt:target.data.uploadedAt,sharedAt:Date.now(),expiry}); }
      if(payload.length>4.8*1024*1024) throw new Error("toolarge");
      await window.storage.set(`share:${code}`,payload,true);
      setLink(`${window.location.href.split("#")[0]}#share=${code}`);
      setStatus("done");
    }catch(e){ setStatus(e.message==="toolarge"?"toolarge":"error"); }
  }
  function copy(){ navigator.clipboard.writeText(link).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2200); }); }

  return (
    <ModalSheet title={isFolder?"📁 分享文件夹":"🔗 分享文件"} onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:12,background:"#F2F2F7",borderRadius:14,padding:"12px 14px",marginBottom:16}}>
        <div style={{width:42,height:42,borderRadius:12,background:isFolder?(target.data.color+"25"):((FILE_TYPES[target.data.type]||{bg:"#F2F2F7"}).bg),display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
          {isFolder?"📁":(FILE_TYPES[target.data.type]||{icon:"📁"}).icon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isFolder?target.data.name:target.data.name}</div>
          <div style={{fontSize:12,color:"#8E8E93",marginTop:2}}>{isFolder?`${folderFiles.length} 个文件`:`${fmtSize(target.data.size)} · ${(FILE_TYPES[target.data.type]||{label:"FILE"}).label}`}</div>
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,color:"#8E8E93",marginBottom:8,fontWeight:500}}>链接有效期</div>
        <div style={{display:"flex",gap:8}}>
          {[["1d","1天"],["7d","7天"],["30d","30天"],["forever","永久"]].map(([v,l])=>(
            <div key={v} onClick={()=>setExpiry(v)} style={{flex:1,textAlign:"center",padding:"8px 0",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",background:expiry===v?"#007AFF":"#F2F2F7",color:expiry===v?"#fff":"#3C3C43",transition:"all 0.15s"}}>{l}</div>
          ))}
        </div>
      </div>
      {status==="idle"&&<div onClick={generate} style={{background:"#007AFF",color:"#fff",padding:"15px",borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:8}}>生成分享链接</div>}
      {status==="saving"&&<div style={{textAlign:"center",padding:14,color:"#8E8E93",fontSize:14}}>上传中…</div>}
      {status==="done"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:8,background:"#F2F2F7",borderRadius:12,padding:"10px 12px"}}>
            <div style={{flex:1,fontSize:12,color:"#3C3C43",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{link}</div>
            <div onClick={copy} style={{color:copied?"#34C759":"#007AFF",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{copied?"✓ 已复制":"复制"}</div>
          </div>
          <div style={{fontSize:12,color:"#34C759",textAlign:"center"}}>✓ 链接已生成，发给对方即可查看</div>
        </div>
      )}
      {status==="toolarge"&&<div style={{fontSize:13,color:"#FF3B30",textAlign:"center",background:"#FFF2F0",borderRadius:10,padding:12}}>⚠️ 超过4.5MB，无法分享。</div>}
    </ModalSheet>
  );
}

/* ═══ SHARE LANDING ═══ */
function ShareLanding({code,onExit}) {
  const [state,setState]=useState("loading");
  const [data,setData]=useState(null);
  const [pages,setPages]=useState([]);
  const [reading,setReading]=useState(null);
  const [imgView,setImgView]=useState(null);
  useEffect(()=>{ (async()=>{ try{ const res=await window.storage.get(`share:${code}`,true); if(!res){setState("notfound");return;} setData(JSON.parse(res.value)); setState("ready"); }catch{setState("notfound");} })(); },[code]);
  async function openPdf(file){ setState("rendering"); try{ const ps=await renderPdf(file.dataUrl); setPages(ps); setReading(file); setState("ready"); }catch{setState("ready");} }
  if(reading) return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"#0d0b08",display:"flex",flexDirection:"column"}}>
      <FlipReader doc={reading} pages={pages} onClose={()=>{setReading(null);setPages([]);}}/>
    </div>
  );
  return (
    <div style={{position:"fixed",inset:0,background:"linear-gradient(160deg,#0f0c09,#1a1410)",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'PingFang SC',sans-serif",overflowY:"auto"}}>
      <div style={{width:"100%",maxWidth:390,flex:1,display:"flex",flexDirection:"column",padding:"60px 20px 40px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:64,height:64,background:"rgba(201,169,110,0.15)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 14px"}}>🗂️</div>
          <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:4}}>云文档</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",letterSpacing:2}}>ENTERPRISE</div>
        </div>
        {(state==="loading"||state==="rendering")&&<div style={{textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:14,marginTop:40}}>{state==="rendering"?"渲染PDF中…":"加载中…"}</div>}
        {state==="notfound"&&<div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🔗</div><div style={{color:"#FF453A",fontSize:14,marginBottom:20}}>链接已失效或不存在</div><div onClick={onExit} style={{background:"rgba(255,255,255,0.1)",color:"#fff",padding:"12px 32px",borderRadius:50,cursor:"pointer",fontSize:14,display:"inline-block"}}>返回首页</div></div>}
        {state==="ready"&&data&&(
          data.shareType==="folder"?(
            <div>
              <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:"16px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:48,height:48,borderRadius:14,background:data.folderColor||"#3B82F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📁</div>
                <div><div style={{fontSize:16,fontWeight:700,color:"#fff"}}>{data.folderName}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:3}}>{data.files.length} 个文件</div></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.files.map(f=>{
                  const meta=FILE_TYPES[f.type]||{label:"FILE",icon:"📁",color:"#888",bg:"#F9FAFB"};
                  return (
                    <div key={f.id} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}}>
                        <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,overflow:"hidden",flexShrink:0}}>
                          {f.type.startsWith("image/")&&f.dataUrl?<img src={f.dataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span>{meta.icon}</span>}
                        </div>
                        <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{fmtSize(f.size)} · {meta.label}</div></div>
                        {f.type==="application/pdf"?<div onClick={()=>openPdf(f)} style={{background:"rgba(201,169,110,0.2)",color:"#c9a96e",padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>翻页读</div>
                        :f.type.startsWith("image/")?<div onClick={()=>setImgView(imgView?.id===f.id?null:f)} style={{background:"rgba(255,255,255,0.1)",color:"#fff",padding:"6px 12px",borderRadius:8,fontSize:12,cursor:"pointer"}}>查看</div>
                        :<a href={f.dataUrl} download={f.name} style={{background:"rgba(255,255,255,0.1)",color:"#fff",padding:"6px 12px",borderRadius:8,fontSize:12,textDecoration:"none"}}>下载</a>}
                      </div>
                      {imgView?.id===f.id&&<div style={{padding:"0 14px 12px"}}><img src={f.dataUrl} alt="" style={{width:"100%",borderRadius:10,maxHeight:180,objectFit:"contain",background:"#000"}}/></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ):(
            <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:24,textAlign:"center"}}>
              <div style={{width:64,height:64,borderRadius:18,background:(FILE_TYPES[data.type]||{bg:"rgba(255,255,255,0.05)"}).bg+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 14px"}}>{(FILE_TYPES[data.type]||{icon:"📁"}).icon}</div>
              <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:6}}>{data.name}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:24}}>{fmtSize(data.size)}</div>
              {data.type==="application/pdf"?<div onClick={()=>openPdf(data)} style={{background:"linear-gradient(135deg,#c9a96e,#e8c87a)",color:"#1a1a2e",padding:"14px",borderRadius:50,fontWeight:800,fontSize:15,cursor:"pointer"}}>📖 3D翻页阅读</div>
              :data.type.startsWith("image/")?<img src={data.dataUrl} alt={data.name} style={{maxWidth:"100%",borderRadius:12,maxHeight:"40vh",objectFit:"contain"}}/>
              :<a href={data.dataUrl} download={data.name} style={{display:"block",background:"#007AFF",color:"#fff",padding:"14px",borderRadius:50,fontWeight:700,fontSize:15,textDecoration:"none"}}>⬇ 下载文件</a>}
            </div>
          )
        )}
        <div onClick={onExit} style={{textAlign:"center",marginTop:24,color:"rgba(255,255,255,0.3)",fontSize:13,cursor:"pointer"}}>返回文件库</div>
      </div>
    </div>
  );
}

/* ═══ MAIN APP ═══ */
export default function App() {
  const [folders,setFolders]=useState([{id:"default",name:"企业资料",color:"#3B82F6",parentId:null,createdAt:Date.now()-86400000}]);
  const [files,setFiles]=useState([]);
  const [tab,setTab]=useState("home"); // home | files | share | mine
  const [currentFolderId,setCurrent]=useState(null);
  const [reader,setReader]=useState(null);
  const [loadingPdf,setLoadingPdf]=useState(null);
  const [shareTarget,setShareTarget]=useState(null);
  const [actionItem,setActionItem]=useState(null);
  const [newFolderMode,setNewFolderMode]=useState(false);
  const [newFolderName,setNewFolderName]=useState("");
  const [newFolderColor,setNewFolderColor]=useState(FOLDER_COLORS[0]);
  const [renameItem,setRenameItem]=useState(null);
  const [renameName,setRenameName]=useState("");
  const [search,setSearch]=useState("");
  const [searchFocus,setSearchFocus]=useState(false);
  const [sharedLinks,setSharedLinks]=useState([]);
  const fileRef=useRef();

  const [shareCode]=useState(()=>{ const m=window.location.hash.match(/#share=([a-z0-9]+)/); return m?m[1]:null; });
  if(shareCode) return <ShareLanding code={shareCode} onExit={()=>{window.location.hash="";window.location.reload();}}/>;

  const breadcrumb=useMemo(()=>{ const path=[]; let id=currentFolderId; while(id){ const f=folders.find(x=>x.id===id); if(!f) break; path.unshift(f); id=f.parentId; } return path; },[currentFolderId,folders]);
  const curFiles=useMemo(()=>files.filter(f=>f.folderId===currentFolderId&&(!search||f.name.toLowerCase().includes(search.toLowerCase()))),[files,currentFolderId,search]);
  const curFolders=useMemo(()=>folders.filter(f=>f.parentId===currentFolderId&&(!search||f.name.toLowerCase().includes(search.toLowerCase()))),[folders,currentFolderId,search]);
  const recentFiles=useMemo(()=>[...files].sort((a,b)=>b.uploadedAt-a.uploadedAt).slice(0,8),[files]);
  const totalSize=useMemo(()=>files.reduce((a,f)=>a+f.size,0),[files]);

  const addFiles=useCallback(rawFiles=>{ Array.from(rawFiles).forEach(f=>{ const r=new FileReader(); r.onload=e=>setFiles(p=>[...p,{id:uid(),name:f.name,type:f.type,size:f.size,dataUrl:e.target.result,folderId:currentFolderId,uploadedAt:Date.now(),aiSummary:null,analyzing:false}]); r.readAsDataURL(f); }); },[currentFolderId]);

  async function openFile(file){ if(file.type==="application/pdf"){ setLoadingPdf(file.id); try{ const ps=await renderPdf(file.dataUrl); setReader({doc:file,pages:ps}); }catch(e){alert("PDF渲染失败");} setLoadingPdf(null); } else if(file.type.startsWith("image/")){ setReader({doc:file,pages:[{url:file.dataUrl,w:800,h:600}]}); } }

  async function analyzeFile(file){ setFiles(p=>p.map(f=>f.id===file.id?{...f,analyzing:true}:f)); try{ let messages; if(file.type.startsWith("image/")) messages=[{role:"user",content:[{type:"image",source:{type:"base64",media_type:file.type,data:file.dataUrl.split(",")[1]}},{type:"text",text:"请用中文简洁描述这张图片内容，40字以内。"}]}]; else if(file.type==="application/pdf") messages=[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:file.dataUrl.split(",")[1]}},{type:"text",text:"请用中文对这份PDF做简洁摘要，50字以内。"}]}]; else messages=[{role:"user",content:`文件「${file.name}」，请根据文件名推测内容，30字以内。`}]; const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages})}); const d=await res.json(); setFiles(p=>p.map(f=>f.id===file.id?{...f,aiSummary:d.content?.[0]?.text||"分析完成",analyzing:false}:f)); }catch{ setFiles(p=>p.map(f=>f.id===file.id?{...f,aiSummary:"分析失败",analyzing:false}:f)); } }

  function createFolder(){ if(!newFolderName.trim()) return; setFolders(p=>[...p,{id:uid(),name:newFolderName.trim(),color:newFolderColor,parentId:currentFolderId,createdAt:Date.now()}]); setNewFolderName(""); setNewFolderMode(false); }

  function recordShare(target){ setSharedLinks(p=>[{id:uid(),target,sharedAt:Date.now()},...p].slice(0,20)); }

  // ─── Phone frame shell ───
  return (
    <div style={{minHeight:"100vh",background:"#1a1a2e",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 0",fontFamily:"'PingFang SC','Noto Sans SC',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent} input{font-family:'PingFang SC','Noto Sans SC',sans-serif} ::-webkit-scrollbar{display:none}`}</style>

      {/* Phone frame */}
      <div style={{width:390,height:844,background:"#000",borderRadius:54,boxShadow:"0 0 0 8px #2a2a2a, 0 0 0 10px #1a1a1a, 0 40px 80px rgba(0,0,0,0.7), inset 0 0 0 2px #3a3a3a",position:"relative",overflow:"hidden",flexShrink:0}}>

        {/* Notch */}
        <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:130,height:34,background:"#000",borderRadius:"0 0 22px 22px",zIndex:300}}/>

        {/* Status bar */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:50,display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"0 24px 8px",zIndex:290,pointerEvents:"none"}}>
          <span style={{fontSize:12,fontWeight:700,color:tab==="mine"?"#fff":"#1C1C1E"}}>9:41</span>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            <span style={{fontSize:12,color:tab==="mine"?"#fff":"#1C1C1E"}}>●●●</span>
            <span style={{fontSize:12,color:tab==="mine"?"#fff":"#1C1C1E"}}>WiFi</span>
            <span style={{fontSize:12,color:tab==="mine"?"#fff":"#1C1C1E"}}>🔋</span>
          </div>
        </div>

        {/* App content */}
        <div style={{position:"absolute",inset:0,borderRadius:54,overflow:"hidden",background:"#F2F2F7"}}>

          {/* ── Reader overlay ── */}
          {reader && (
            reader.doc.type==="application/pdf"
              ? <FlipReader doc={reader.doc} pages={reader.pages} onClose={()=>setReader(null)}/>
              : <div onClick={()=>setReader(null)} style={{position:"absolute",inset:0,zIndex:200,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <img src={reader.pages[0].url} alt="" style={{maxWidth:"90%",maxHeight:"80%",borderRadius:12,objectFit:"contain"}}/>
                  <div style={{position:"absolute",top:60,right:20,background:"rgba(255,255,255,0.15)",width:36,height:36,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:"#fff"}} onClick={()=>setReader(null)}>✕</div>
                </div>
          )}

          {/* ── New Folder Sheet ── */}
          {newFolderMode && (
            <ModalSheet title="新建文件夹" onClose={()=>setNewFolderMode(false)}>
              <input value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} placeholder="文件夹名称" autoFocus
                onKeyDown={e=>e.key==="Enter"&&createFolder()}
                style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #E5E5EA",fontSize:15,outline:"none",marginBottom:16}}/>
              <div style={{fontSize:13,color:"#8E8E93",marginBottom:10,fontWeight:500}}>选择颜色</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
                {FOLDER_COLORS.map(c=><div key={c} onClick={()=>setNewFolderColor(c)} style={{width:36,height:36,borderRadius:10,background:c,cursor:"pointer",border:newFolderColor===c?"3px solid #1C1C1E":"3px solid transparent",transition:"all 0.15s"}}/>)}
              </div>
              <div onClick={createFolder} style={{background:newFolderName.trim()?"#007AFF":"#C7C7CC",color:"#fff",padding:"14px",borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700,cursor:newFolderName.trim()?"pointer":"default"}}>创建文件夹</div>
            </ModalSheet>
          )}

          {/* ── Rename Sheet ── */}
          {renameItem && (
            <ModalSheet title="重命名" onClose={()=>setRenameItem(null)}>
              <input value={renameName} onChange={e=>setRenameName(e.target.value)} autoFocus
                onKeyDown={e=>e.key==="Enter"&&(renameItem.kind==="folder"?setFolders(p=>p.map(f=>f.id===renameItem.id?{...f,name:renameName.trim()}:f)):setFiles(p=>p.map(f=>f.id===renameItem.id?{...f,name:renameName.trim()}:f)),setRenameItem(null))}
                style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #E5E5EA",fontSize:15,outline:"none",marginBottom:16}}/>
              <div onClick={()=>{ if(!renameName.trim()) return; if(renameItem.kind==="folder") setFolders(p=>p.map(f=>f.id===renameItem.id?{...f,name:renameName.trim()}:f)); else setFiles(p=>p.map(f=>f.id===renameItem.id?{...f,name:renameName.trim()}:f)); setRenameItem(null); }} style={{background:"#007AFF",color:"#fff",padding:"14px",borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700,cursor:"pointer"}}>保存</div>
            </ModalSheet>
          )}

          {/* ── Action Sheet ── */}
          {actionItem && (
            <ActionSheet
              title={actionItem.name}
              onClose={()=>setActionItem(null)}
              items={actionItem.kind==="folder"?[
                {icon:"📖",label:"打开",bold:true,action:()=>{ setCurrent(actionItem.id); setTab("files"); }},
                {icon:"🔗",label:"分享文件夹",action:()=>{ const t={type:"folder",data:folders.find(f=>f.id===actionItem.id)}; setShareTarget(t); recordShare(t); }},
                {icon:"✏️",label:"重命名",action:()=>{ setRenameItem({id:actionItem.id,kind:"folder"}); setRenameName(actionItem.name); }},
                {icon:"🗑",label:"删除",destructive:true,action:()=>{ setFolders(p=>p.filter(f=>f.id!==actionItem.id)); setFiles(p=>p.filter(f=>f.folderId!==actionItem.id)); }},
              ]:[
                {icon:"📂",label:"打开",bold:true,action:()=>openFile(files.find(f=>f.id===actionItem.id))},
                {icon:"🔗",label:"分享文件",action:()=>{ const t={type:"file",data:files.find(f=>f.id===actionItem.id)}; setShareTarget(t); recordShare(t); }},
                {icon:"🤖",label:"AI 智能分析",action:()=>analyzeFile(files.find(f=>f.id===actionItem.id))},
                {icon:"✏️",label:"重命名",action:()=>{ setRenameItem({id:actionItem.id,kind:"file"}); setRenameName(actionItem.name); }},
                {icon:"🗑",label:"删除",destructive:true,action:()=>setFiles(p=>p.filter(f=>f.id!==actionItem.id))},
              ]}
            />
          )}

          {/* ── Share Modal ── */}
          {shareTarget && <ShareModal target={shareTarget} files={files} onClose={()=>setShareTarget(null)}/>}

          {/* ═══ PAGE CONTENT ═══ */}

          {/* ── HOME PAGE ── */}
          {tab==="home" && (
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {/* Header gradient */}
              <div style={{background:"linear-gradient(160deg,#1a1a2e 0%,#2d2d54 100%)",padding:"56px 20px 24px",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                  <div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:1,marginBottom:4}}>企业文档管理</div>
                    <div style={{fontSize:22,fontWeight:700,color:"#fff"}}>云文档 🗂️</div>
                  </div>
                  <div onClick={()=>fileRef.current.click()} style={{width:42,height:42,background:"rgba(255,255,255,0.12)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:20}}>⊕</div>
                </div>
                {/* Stats row */}
                <div style={{display:"flex",gap:10}}>
                  {[{v:files.length,l:"文件总数",icon:"📄"},{v:folders.length,l:"文件夹",icon:"📁"},{v:fmtSize(totalSize),l:"已用空间",icon:"💾"}].map(({v,l,icon})=>(
                    <div key={l} style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:14,padding:"10px 10px 10px"}}>
                      <div style={{fontSize:18}}>{icon}</div>
                      <div style={{fontSize:16,fontWeight:700,color:"#fff",marginTop:4}}>{v}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{flex:1,overflowY:"auto",padding:"16px 0 80px"}}>
                {/* Quick actions */}
                <div style={{padding:"0 16px 16px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[
                      {icon:"⬆️",label:"上传文件",sub:"支持PDF/图片/文档",color:"#007AFF",action:()=>fileRef.current.click()},
                      {icon:"📁",label:"新建文件夹",sub:"整理你的资料",color:"#34C759",action:()=>{ setTab("files"); setTimeout(()=>setNewFolderMode(true),100); }},
                      {icon:"🔗",label:"分享管理",sub:"查看已分享内容",color:"#FF9500",action:()=>setTab("share")},
                      {icon:"🤖",label:"AI 分析",sub:"智能读取文档",color:"#AF52DE",action:()=>setTab("files")},
                    ].map(({icon,label,sub,color,action})=>(
                      <div key={label} onClick={action} style={{background:"#fff",borderRadius:16,padding:"16px 14px",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",transition:"transform 0.12s,box-shadow 0.12s"}}
                        onMouseEnter={e=>{e.currentTarget.style.transform="scale(0.97)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";}}>
                        <div style={{width:40,height:40,borderRadius:12,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:10}}>{icon}</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#1C1C1E"}}>{label}</div>
                        <div style={{fontSize:11,color:"#8E8E93",marginTop:2}}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Folders quick access */}
                {folders.filter(f=>f.parentId===null).length>0 && (
                  <div style={{padding:"0 16px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>文件夹</div>
                      <div onClick={()=>setTab("files")} style={{fontSize:13,color:"#007AFF",cursor:"pointer"}}>全部 ›</div>
                    </div>
                    <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
                      {folders.filter(f=>f.parentId===null).map(f=>(
                        <div key={f.id} onClick={()=>{ setCurrent(f.id); setTab("files"); }}
                          style={{flexShrink:0,width:100,background:"#fff",borderRadius:16,padding:"14px 10px",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",textAlign:"center"}}>
                          <div style={{width:44,height:44,borderRadius:14,background:f.color+"20",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",fontSize:22}}>
                            <span style={{filter:`drop-shadow(0 2px 4px ${f.color}40)`}}>📁</span>
                          </div>
                          <div style={{fontSize:12,fontWeight:600,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                          <div style={{fontSize:10,color:"#8E8E93",marginTop:2}}>{files.filter(x=>x.folderId===f.id).length} 个</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent files */}
                {recentFiles.length>0 && (
                  <div style={{padding:"0 16px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>最近文件</div>
                    </div>
                    <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                      {recentFiles.map((f,i)=>{
                        const meta=FILE_TYPES[f.type]||{label:"FILE",icon:"📁",color:"#888",bg:"#F9FAFB"};
                        return (
                          <div key={f.id}>
                            {i>0&&<div style={{height:0.5,background:"#F2F2F7",marginLeft:58}}/>}
                            <div onClick={()=>openFile(f)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer"}}>
                              <div style={{width:40,height:40,borderRadius:10,background:meta.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,overflow:"hidden",flexShrink:0}}>
                                {f.type.startsWith("image/")&&f.dataUrl?<img src={f.dataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span>{meta.icon}</span>}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                                <div style={{fontSize:11,color:"#8E8E93",marginTop:2,display:"flex",gap:6,alignItems:"center"}}>
                                  <span style={{background:meta.color+"18",color:meta.color,padding:"1px 6px",borderRadius:4,fontWeight:600,fontSize:10}}>{meta.label}</span>
                                  <span>{fmtDate(f.uploadedAt)}</span>
                                </div>
                              </div>
                              <span style={{color:"#C7C7CC",fontSize:16}}>›</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recentFiles.length===0 && (
                  <div style={{textAlign:"center",padding:"40px 20px"}}>
                    <div style={{fontSize:48,marginBottom:14}}>📂</div>
                    <div style={{fontSize:16,fontWeight:600,color:"#3C3C43",marginBottom:6}}>还没有上传任何文件</div>
                    <div style={{fontSize:13,color:"#8E8E93",marginBottom:20}}>点击上传文件或新建文件夹</div>
                    <div onClick={()=>fileRef.current.click()} style={{display:"inline-block",background:"#007AFF",color:"#fff",padding:"12px 28px",borderRadius:50,fontSize:14,fontWeight:700,cursor:"pointer"}}>立即上传</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FILES PAGE ── */}
          {tab==="files" && (
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {/* Nav bar */}
              <div style={{background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"50px 16px 10px",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  {currentFolderId && <div onClick={()=>{ setCurrent(breadcrumb.length>1?breadcrumb[breadcrumb.length-2].id:null); }} style={{width:32,height:32,borderRadius:10,background:"#F2F2F7",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#007AFF",flexShrink:0}}>‹</div>}
                  <div style={{flex:1,fontSize:17,fontWeight:700,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {currentFolderId ? (breadcrumb[breadcrumb.length-1]?.name||"文件") : "全部文件"}
                  </div>
                  <div onClick={()=>{ setNewFolderMode(true); }} style={{width:32,height:32,borderRadius:10,background:"#F2F2F7",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#007AFF"}}>📁</div>
                  <div onClick={()=>fileRef.current.click()} style={{width:32,height:32,borderRadius:10,background:"#007AFF",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#fff"}}>⊕</div>
                </div>
                {/* Breadcrumb */}
                {breadcrumb.length>0&&(
                  <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:8,overflowX:"auto"}}>
                    <span onClick={()=>setCurrent(null)} style={{fontSize:11,color:"#007AFF",cursor:"pointer",whiteSpace:"nowrap"}}>全部</span>
                    {breadcrumb.map((f,i)=>(
                      <span key={f.id} style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{color:"#C7C7CC",fontSize:11}}>›</span>
                        <span onClick={()=>setCurrent(f.id)} style={{fontSize:11,color:i===breadcrumb.length-1?"#1C1C1E":"#007AFF",fontWeight:i===breadcrumb.length-1?600:400,cursor:"pointer",whiteSpace:"nowrap"}}>{f.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                {/* Search */}
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#8E8E93",fontSize:14}}>🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setSearchFocus(true)} onBlur={()=>setSearchFocus(false)} placeholder="搜索文件和文件夹…"
                    style={{width:"100%",padding:"8px 12px 8px 30px",borderRadius:10,border:"none",background:"#F2F2F7",fontSize:13,outline:"none"}}/>
                </div>
              </div>

              {/* Content */}
              <div style={{flex:1,overflowY:"auto",padding:"12px 16px 80px"}}>
                {/* Share folder CTA */}
                {currentFolderId && (
                  <div onClick={()=>{ const f=folders.find(x=>x.id===currentFolderId); setShareTarget({type:"folder",data:f}); recordShare({type:"folder",data:f}); }} style={{background:"linear-gradient(135deg,#007AFF,#5856D6)",borderRadius:14,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
                    <div style={{fontSize:22}}>🔗</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>分享整个文件夹</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:2}}>生成链接，无需登录即可查看</div>
                    </div>
                    <span style={{color:"rgba(255,255,255,0.6)",fontSize:16}}>›</span>
                  </div>
                )}

                {curFolders.length===0&&curFiles.length===0 && (
                  <div style={{textAlign:"center",padding:"50px 0",color:"#8E8E93"}}>
                    <div style={{fontSize:44,marginBottom:12}}>📂</div>
                    <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>{search?"没有匹配结果":"这里还没有内容"}</div>
                    <div style={{fontSize:12}}>拖拽上传或点击右上角按钮</div>
                  </div>
                )}

                {/* Folders */}
                {curFolders.length>0&&(
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#8E8E93",letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>文件夹</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {curFolders.map(f=>(
                        <div key={f.id}
                          onContextMenu={e=>{e.preventDefault();setActionItem({...f,kind:"folder"});}}
                          style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                          <div onClick={()=>{ setCurrent(f.id); }} style={{padding:"14px 12px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center"}}>
                            <div style={{width:48,height:48,borderRadius:14,background:f.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:8}}>📁</div>
                            <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",textAlign:"center"}}>{f.name}</div>
                            <div style={{fontSize:11,color:"#8E8E93",marginTop:2}}>{files.filter(x=>x.folderId===f.id).length} 个文件</div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"0.5px solid #F2F2F7"}}>
                            <div onClick={()=>{ const t={type:"folder",data:f}; setShareTarget(t); recordShare(t); }} style={{padding:"8px 0",textAlign:"center",fontSize:12,color:"#007AFF",fontWeight:600,cursor:"pointer",borderRight:"0.5px solid #F2F2F7"}}>分享</div>
                            <div onClick={()=>setActionItem({...f,kind:"folder"})} style={{padding:"8px 0",textAlign:"center",fontSize:12,color:"#3C3C43",cursor:"pointer"}}>更多</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files */}
                {curFiles.length>0&&(
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"#8E8E93",letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>文件 ({curFiles.length})</div>
                    <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                      {curFiles.map((f,i)=>{
                        const meta=FILE_TYPES[f.type]||{label:"FILE",icon:"📁",color:"#888",bg:"#F9FAFB"};
                        return (
                          <div key={f.id}>
                            {i>0&&<div style={{height:0.5,background:"#F2F2F7",marginLeft:58}}/>}
                            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",position:"relative"}}>
                              {loadingPdf===f.id&&<div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5,borderRadius:0}}><span style={{fontSize:12,color:"#666"}}>渲染中…</span></div>}
                              <div onClick={()=>openFile(f)} style={{width:44,height:44,borderRadius:12,background:meta.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,overflow:"hidden",flexShrink:0,cursor:"pointer"}}>
                                {f.type.startsWith("image/")&&f.dataUrl?<img src={f.dataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span>{meta.icon}</span>}
                              </div>
                              <div onClick={()=>openFile(f)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                                <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:3}}>
                                  <span style={{background:meta.color+"18",color:meta.color,padding:"1px 6px",borderRadius:4,fontWeight:600,fontSize:10}}>{meta.label}</span>
                                  <span style={{fontSize:11,color:"#8E8E93"}}>{fmtSize(f.size)}</span>
                                  <span style={{fontSize:11,color:"#C7C7CC"}}>·</span>
                                  <span style={{fontSize:11,color:"#8E8E93"}}>{fmtDate(f.uploadedAt)}</span>
                                </div>
                                {f.aiSummary&&<div style={{fontSize:11,color:"#6D6D72",marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.aiSummary}</div>}
                              </div>
                              <div style={{display:"flex",gap:6,flexShrink:0}}>
                                <div onClick={()=>{ const t={type:"file",data:f}; setShareTarget(t); recordShare(t); }} style={{width:30,height:30,borderRadius:9,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}}>🔗</div>
                                <div onClick={()=>setActionItem({...f,kind:"file"})} style={{width:30,height:30,borderRadius:9,background:"#F2F2F7",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:"#8E8E93",fontWeight:700}}>…</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SHARE PAGE ── */}
          {tab==="share" && (
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"50px 16px 14px",flexShrink:0}}>
                <div style={{fontSize:17,fontWeight:700,color:"#1C1C1E"}}>分享记录</div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>
                {/* Share new file CTA */}
                <div onClick={()=>{ setTab("files"); }} style={{background:"linear-gradient(135deg,#34C759,#30D158)",borderRadius:16,padding:"16px",marginBottom:16,display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}>
                  <div style={{width:44,height:44,background:"rgba(255,255,255,0.2)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🔗</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>分享新文件</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.8)",marginTop:2}}>选择文件或文件夹生成分享链接</div>
                  </div>
                  <span style={{color:"rgba(255,255,255,0.7)",fontSize:18}}>›</span>
                </div>

                {sharedLinks.length===0&&(
                  <div style={{textAlign:"center",padding:"50px 0",color:"#8E8E93"}}>
                    <div style={{fontSize:44,marginBottom:12}}>🔗</div>
                    <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>还没有分享记录</div>
                    <div style={{fontSize:12}}>去文件页面分享文件或文件夹</div>
                  </div>
                )}

                {sharedLinks.length>0&&(
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"#8E8E93",letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>已分享 ({sharedLinks.length})</div>
                    <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                      {sharedLinks.map((link,i)=>(
                        <div key={link.id}>
                          {i>0&&<div style={{height:0.5,background:"#F2F2F7",marginLeft:58}}/>}
                          <div onClick={()=>setShareTarget(link.target)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer"}}>
                            <div style={{width:42,height:42,borderRadius:12,background:link.target.type==="folder"?((link.target.data.color||"#3B82F6")+"20"):(FILE_TYPES[link.target.data?.type]||{bg:"#F9FAFB"}).bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                              {link.target.type==="folder"?"📁":(FILE_TYPES[link.target.data?.type]||{icon:"📁"}).icon}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{link.target.type==="folder"?link.target.data.name:link.target.data?.name}</div>
                              <div style={{fontSize:11,color:"#8E8E93",marginTop:2,display:"flex",gap:6,alignItems:"center"}}>
                                <span style={{background:link.target.type==="folder"?"#EFF6FF":"#F0FDF4",color:link.target.type==="folder"?"#3B82F6":"#22C55E",padding:"1px 6px",borderRadius:4,fontWeight:600,fontSize:10}}>{link.target.type==="folder"?"文件夹":"文件"}</span>
                                <span>{fmtDate(link.sharedAt)}</span>
                              </div>
                            </div>
                            <div style={{color:"#007AFF",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>重新分享</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MINE PAGE ── */}
          {tab==="mine" && (
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(160deg,#1a1a2e 0%,#2d2d54 60%,#F2F2F7 60%)"}}>
              <div style={{padding:"60px 20px 30px",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div style={{width:64,height:64,borderRadius:22,background:"linear-gradient(135deg,#c9a96e,#e8c87a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,boxShadow:"0 4px 16px rgba(201,169,110,0.4)"}}>👤</div>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:"#fff"}}>企业管理员</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:3}}>企业版账户 · 高级权限</div>
                  </div>
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"0 16px 80px",background:"#F2F2F7"}}>
                {/* Storage card */}
                <div style={{background:"#fff",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",marginBottom:12}}>存储空间</div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:6,marginBottom:10}}>
                    <span style={{fontSize:24,fontWeight:700,color:"#1C1C1E"}}>{fmtSize(totalSize)}</span>
                    <span style={{fontSize:13,color:"#8E8E93",marginBottom:3}}>/ 无限制</span>
                  </div>
                  <div style={{height:6,background:"#F2F2F7",borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${Math.min((totalSize/(50*1024*1024))*100,100)}%`,height:"100%",background:"linear-gradient(90deg,#007AFF,#5856D6)",borderRadius:3,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                    <span style={{fontSize:11,color:"#8E8E93"}}>{files.length} 个文件 · {folders.length} 个文件夹</span>
                    <span style={{fontSize:11,color:"#8E8E93"}}>{sharedLinks.length} 次分享</span>
                  </div>
                </div>
                {/* Settings */}
                {[
                  {section:"文件管理",items:[{icon:"📤",color:"#007AFF",label:"上传文件",action:()=>fileRef.current.click()},{icon:"📁",color:"#FF9500",label:"新建文件夹",action:()=>{ setTab("files"); setTimeout(()=>setNewFolderMode(true),100); }},{icon:"🔗",color:"#34C759",label:"分享记录",action:()=>setTab("share")}]},
                  {section:"关于",items:[{icon:"ℹ️",color:"#8E8E93",label:"版本 2.0.0",action:()=>{}},{icon:"🌐",color:"#5856D6",label:"云文档企业版",action:()=>{}}]},
                ].map(({section,items})=>(
                  <div key={section} style={{marginBottom:16}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#8E8E93",padding:"0 4px 8px",letterSpacing:0.5}}>{section}</div>
                    <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                      {items.map((item,i)=>(
                        <div key={item.label}>
                          {i>0&&<div style={{height:0.5,background:"#F2F2F7",marginLeft:52}}/>}
                          <div onClick={item.action} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",cursor:"pointer"}}>
                            <div style={{width:32,height:32,borderRadius:9,background:item.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{item.icon}</div>
                            <span style={{flex:1,fontSize:14,color:"#1C1C1E",fontWeight:500}}>{item.label}</span>
                            <span style={{color:"#C7C7CC",fontSize:16}}>›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ BOTTOM TAB BAR ═══ */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:82,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",borderTop:"0.5px solid rgba(0,0,0,0.12)",display:"flex",alignItems:"flex-start",paddingTop:8,zIndex:100}}>
            {[
              {id:"home",icon:tab==="home"?"🏠":"🏡",label:"首页"},
              {id:"files",icon:tab==="files"?"📂":"📁",label:"文件"},
              {id:"share",icon:tab==="share"?"🔗":"🔗",label:"分享"},
              {id:"mine",icon:tab==="mine"?"👤":"👤",label:"我的"},
            ].map(({id,icon,label})=>(
              <div key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",paddingBottom:20}}>
                <div style={{fontSize:22,lineHeight:1,filter:tab===id?"none":"grayscale(1) opacity(0.5)",transition:"filter 0.2s"}}>{icon}</div>
                <div style={{fontSize:10,fontWeight:tab===id?700:400,color:tab===id?"#007AFF":"#8E8E93",transition:"color 0.2s"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={e=>addFiles(e.target.files)} style={{display:"none"}}/>
    </div>
  );
}
