
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signInWithRedirect,getRedirectResult,signOut} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp,onSnapshot,runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const config={apiKey:"AIzaSyCoiR62g9Z7TLCwLKe0P1DiZWbJGDniKOw",authDomain:"nico-life-hub.firebaseapp.com",projectId:"nico-life-hub",storageBucket:"nico-life-hub.firebasestorage.app",messagingSenderId:"205338393707",appId:"1:205338393707:web:ed76da7b3ec40ba1cc852e"};
const keys=['nico-calendar-events-v1','nico-calendar-regular-shift-v1','nico-calendar-fmla-v1','nico-hertz-pay-v1','nico-planning-tools-v1','nico-hertz-timecards-v1','nico-hertz-paychecks-v1','nico-lambda-workspace-v1','nico-life-suite-v1'];
const status=document.getElementById('cloudStatus'),login=document.getElementById('cloudLogin'),logout=document.getElementById('cloudLogout'),upload=document.getElementById('cloudUpload'),restore=document.getElementById('cloudRestore'),auto=document.getElementById('cloudAuto'),syncStatus=document.getElementById('cloudSyncStatus');
const AUTO_KEY='nico-life-hub-auto-sync-v1';
const say=s=>{status.textContent=s},notice=s=>{syncStatus.textContent=s};
const read=k=>{const raw=localStorage.getItem(k);if(raw===null)return null;try{return JSON.parse(raw)}catch{return null}};
const serial=k=>JSON.stringify(read(k));
let auth,db,user=null,unsub=[],timer=null,enabled=false,ready=false,processing=false;
const states=new Map();
function stop(){enabled=false;ready=false;for(const u of unsub)u();unsub=[];if(timer)clearInterval(timer);timer=null;states.clear();auto.textContent='🔄 Enable automatic sync';notice('Automatic sync is off. Manual backup is still available.')}
function syncDoc(k){return doc(db,'users',user.uid,'sync',k)}
function apply(k,val){if(val===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(val))}
async function startSync(){
 if(!user)return;
 stop();enabled=true;auto.textContent='⏹ Turn off automatic sync';notice('Checking both devices before syncing…');
 try{
  for(const k of keys){
   const ref=syncDoc(k),snap=await getDoc(ref),local=serial(k);
   if(!enabled)return;
   if(snap.exists()){
    const remote=snap.data(),remoteStr=JSON.stringify(remote.value??null);
    if(remoteStr!==local){
     const label=k.replace('nico-','').replaceAll('-',' ');
     const accept=confirm('Automatic sync setup: '+label+' differs from the cloud. Press OK to use the CLOUD version on this device, or Cancel to keep this device’s version and stop automatic sync. You can save a manual backup first.');
     if(!accept){stop();notice('Automatic sync paused. No local data was replaced. Use cloud backup/restore to reconcile, then enable again.');return}
     apply(k,remote.value??null);
     sessionStorage.setItem('nico-cloud-reload-needed','yes');
    }
    states.set(k,{version:remote.version||1,value:remoteStr});
   }else{
    await runTransaction(db,async tx=>{
     const existing=await tx.get(ref);
     if(existing.exists())return;
     tx.set(ref,{value:read(k),version:1,updatedAt:serverTimestamp()});
    });
    const fresh=await getDoc(ref),d=fresh.data();
    if(JSON.stringify(d.value??null)!==local){stop();notice('A newer cloud value appeared. Refresh and enable sync again.');return}
    states.set(k,{version:d.version||1,value:local});
   }
  }
  if(sessionStorage.getItem('nico-cloud-reload-needed')==='yes'){
   sessionStorage.removeItem('nico-cloud-reload-needed');
   localStorage.setItem(AUTO_KEY,'yes');location.reload();return;
  }
  ready=true;localStorage.setItem(AUTO_KEY,'yes');
  for(const k of keys)unsub.push(onSnapshot(syncDoc(k),snap=>{
   if(!ready||!snap.exists())return;
   const d=snap.data(),state=states.get(k),incoming=JSON.stringify(d.value??null);
   if(!state||d.version<=state.version)return;
   const current=serial(k);
   if(incoming===current){states.set(k,{version:d.version,value:incoming});return}if(current!==state.value){stop();notice('Sync paused: both devices changed data. Your local changes are preserved. Save a backup and reconcile before restarting.');return}
   apply(k,d.value??null);states.set(k,{version:d.version,value:incoming});
   notice('Cloud changes received. Updating Life Hub…');location.reload();
  },()=>{stop();notice('Sync disconnected. Your local information remains available.')}));
  timer=setInterval(pushChanges,3500);
  notice('Automatic sync ON. Changes sync while Life Hub is open. Reload to see changes received from another device.');
 }catch(e){stop();notice('Automatic sync could not start: '+(e.code||e.message||'Please try again.'))}
}
async function pushChanges(){
 if(!ready||processing||!user)return;
 processing=true;
 try{
  for(const k of keys){
   if(!ready)break;
   const state=states.get(k),local=serial(k);
   if(!state||local===state.value)continue;
   const ref=syncDoc(k);
   try{
    await runTransaction(db,async tx=>{
     const snap=await tx.get(ref),remote=snap.data();
     if(!snap.exists()||remote.version!==state.version||JSON.stringify(remote.value??null)!==state.value)throw Error('SYNC_CONFLICT');
     tx.set(ref,{value:JSON.parse(local),version:state.version+1,updatedAt:serverTimestamp()});
    });
    states.set(k,{version:state.version+1,value:local});
    notice('Latest changes synced to your Google account.');
   }catch(e){
    if(e.message==='SYNC_CONFLICT'){stop();notice('Sync paused: a newer cloud change exists. Your local edits are safe. Review before re-enabling.');return}
    notice('Offline or sync unavailable. Your changes are saved locally; retrying…');
   }
  }
 }finally{processing=false}
}
try{
 const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);
 const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 login.addEventListener('click',async()=>{say('Opening Google sign-in…');try{await signInWithPopup(auth,provider)}catch(e){if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(e.code)){say('Opening Google sign-in in this tab…');await signInWithRedirect(auth,provider)}else say('Sign-in unsuccessful: '+(e.code||'Please try again.'))}});
 logout.addEventListener('click',async()=>{stop();localStorage.removeItem(AUTO_KEY);await signOut(auth);say('Signed out. Browser data remains on this device.')});
 onAuthStateChanged(auth,u=>{stop();user=u;login.hidden=!!u;logout.hidden=!u;upload.disabled=!u;restore.disabled=!u;auto.disabled=!u;say(u?'Signed in as '+(u.email||'Google user')+'. Private cloud backup available.':'Not signed in. Existing calendar data stays on this device.');if(u&&localStorage.getItem(AUTO_KEY)==='yes')startSync()});
 getRedirectResult(auth).catch(e=>say('Google sign-in could not finish: '+(e.code||'Please retry.')));
 auto.addEventListener('click',()=>{if(enabled){stop();localStorage.removeItem(AUTO_KEY)}else startSync()});
 upload.addEventListener('click',async()=>{if(!user)return;const data={};for(const k of keys){const v=read(k);if(v!==null)data[k]=v}if(!confirm('Save a private manual backup of this device’s calendar and trackers? This replaces your previous manual cloud backup.'))return;upload.disabled=true;say('Saving cloud backup…');try{await setDoc(doc(db,'users',user.uid,'backups','lifeHub'),{data,updatedAt:serverTimestamp(),version:1});say('Cloud backup saved.')}catch(e){say('Backup failed: '+(e.code||'Check connection.'))}finally{upload.disabled=false}});
 restore.addEventListener('click',async()=>{if(!user)return;if(enabled){say('Turn off automatic sync before restoring a manual backup.');return}restore.disabled=true;say('Checking for cloud backup…');try{const snap=await getDoc(doc(db,'users',user.uid,'backups','lifeHub'));if(!snap.exists()){say('No manual cloud backup found.');return}const data=snap.data().data;if(!data||typeof data!=='object')throw Error('Invalid backup');if(!confirm('Restore the manual backup to THIS device? This replaces locally saved calendar entries and trackers. Export a backup first if needed.')){say('Restore cancelled.');return}for(const k of keys){if(Object.prototype.hasOwnProperty.call(data,k))apply(k,data[k]);else localStorage.removeItem(k)}say('Restored. Reloading Life Hub…');location.reload()}catch(e){say('Restore failed: '+(e.code||e.message||'Please retry.'))}finally{restore.disabled=false}});
}catch(e){say('Cloud connection unavailable. Your existing calendar still works.')}
