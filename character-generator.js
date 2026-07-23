const STATES={character:[['idle','아이들'],['attack','공격']],monster:[['move','이동'],['attack','공격'],['death','사망']],boss:[['move','이동'],['attack','공격'],['death','사망']]};
const MODE_LABEL={character:'플레이어 캐릭터',monster:'적 몬스터',boss:'보스 몬스터'};
const form=document.querySelector('#generatorForm');
const resultGrid=document.querySelector('#resultGrid');
const emptyState=document.querySelector('#emptyState');
const stateGuide=document.querySelector('#stateGuide');
const generateButton=document.querySelector('#generateButton');
const cancelButton=document.querySelector('#cancelButton');
const referenceInput=document.querySelector('#referenceInput');
const uploadBox=document.querySelector('#uploadBox');
const referencePreview=document.querySelector('#referencePreview');
let mode='character',referenceData='',activeRequest=null;

function values(){return{mode,name:document.querySelector('#unitName').value.trim(),archetype:document.querySelector('#archetype').value.trim(),features:document.querySelector('#features').value.trim(),palette:document.querySelector('#palette').value.trim(),extra:document.querySelector('#extra').value.trim(),targetSize:Number(document.querySelector('#targetSize').value),states:STATES[mode]};}
function basePrompt(v){return `Create one ultra-simple SD chibi 2D fantasy mobile game ${MODE_LABEL[v.mode]} as a clean game sprite asset.

IDENTITY: ${v.name || 'unnamed unit'}, ${v.archetype || 'fantasy unit'}. Only these signature features: ${v.features || 'one clear signature feature'}. Main palette: ${v.palette || 'a limited harmonious palette'}. ${v.extra}

STYLE LOCK: 1.5–1.8 heads tall; the oversized head is 65–70% of total height; extremely tiny round torso, very short limbs, tiny feet, rounded mitten hands. Compact almost-square silhouette readable when reduced to ${v.targetSize}×${v.targetSize}. Thick smooth near-black outline. Only 6–8 main colors. Mostly flat colors, with exactly one broad simple shadow shape and at most one tiny highlight per major form. Western casual fantasy tower-defense game mood; charming and humorous but still a usable combat unit. Simplify every feature aggressively.

CAMERA AND LAYOUT: top-down three-quarter view at about 70 degrees, centered single full-body unit, generous empty space, warm ivory solid background, one small flat oval ground shadow. ${v.mode==='character'?'The character faces and looks toward the TOP of the image, attacking enemies arriving from above.':'The enemy faces and moves toward the BOTTOM of the image, descending toward the player.'} ${v.mode==='boss'?'Make the silhouette about 1.2 times larger than a normal monster while preserving the same SD proportions.':''}

CONSISTENCY: preserve the exact same face, proportions, colors, outfit, equipment, outline thickness, camera angle, scale, and design across every state. Change only the pose and action required by the state.

AVOID: realistic anatomy, long limbs, anime style, oversized glossy eyes, painterly texture, 3D rendering, gradients, realistic materials, detailed armor, fabric folds, tiny accessories, fingers, text, logo, UI, border, scenery, watermark, multiple characters, sprite sheet.`;}
function statePrompt(v,state,label){const action={idle:'IDLE STATE: calm ready stance, looking upward, weapon or magic held ready, no attack effect.',move:'MOVE STATE: falling or advancing downward, body tilted slightly forward, tiny motion cue only, no attack effect.',attack:'ATTACK STATE: a clear forceful attack aimed toward the top of the image for a player character or toward the bottom for an enemy; one large simple readable attack effect only.',death:'DEATH STATE: clearly defeated and collapsing sideways, eyes closed, no gore, no attack effect.'}[state];return `${basePrompt(v)}\n\nOUTPUT THIS STATE ONLY — ${label}: ${action}`;}
function updateGuide(){const names=STATES[mode].map(s=>s[1]).join('·');stateGuide.textContent=`${MODE_LABEL[mode]}는 ${names} ${STATES[mode].length}개 상태로 생성됩니다.`;}
document.querySelectorAll('.mode').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.mode').forEach(b=>b.classList.remove('active'));btn.classList.add('active');mode=btn.dataset.mode;updateGuide();}));

function loadReference(file){if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)){alert('PNG, JPG, WEBP 이미지만 사용할 수 있습니다.');return;}const reader=new FileReader();reader.onload=()=>{referenceData=reader.result;referencePreview.src=referenceData;uploadBox.classList.add('has-image');};reader.readAsDataURL(file);}
uploadBox.addEventListener('click',e=>{if(e.target.id!=='removeReference')referenceInput.click();});
referenceInput.addEventListener('change',()=>loadReference(referenceInput.files[0]));
['dragenter','dragover'].forEach(n=>uploadBox.addEventListener(n,e=>{e.preventDefault();uploadBox.classList.add('drag');}));
['dragleave','drop'].forEach(n=>uploadBox.addEventListener(n,e=>{e.preventDefault();uploadBox.classList.remove('drag');}));
uploadBox.addEventListener('drop',e=>loadReference(e.dataTransfer.files[0]));
document.querySelector('#removeReference').addEventListener('click',e=>{e.stopPropagation();referenceData='';referenceInput.value='';referencePreview.removeAttribute('src');uploadBox.classList.remove('has-image');});

const dialog=document.querySelector('#promptDialog');
document.querySelector('#promptButton').addEventListener('click',()=>{const v=values();document.querySelector('#promptPreview').textContent=v.states.map(([s,l])=>statePrompt(v,s,l)).join('\n\n────────────\n\n');dialog.showModal();});
document.querySelector('#closeDialog').addEventListener('click',()=>dialog.close());
document.querySelector('#copyPrompt').addEventListener('click',async e=>{await navigator.clipboard.writeText(document.querySelector('#promptPreview').textContent);e.target.textContent='복사됨';setTimeout(()=>e.target.textContent='복사',1200);});

function createCard(state,label){const card=document.createElement('article');card.className='result-card';card.dataset.state=state;card.innerHTML=`<div class="image-stage"><div class="loader"></div></div><div class="card-foot"><strong>${label}</strong><span>생성 대기</span></div>`;resultGrid.append(card);return card;}
async function downloadSized(url,name,size){const img=new Image();img.crossOrigin='anonymous';img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,size,size);const a=document.createElement('a');a.download=`${name}-${size}.png`;a.href=canvas.toDataURL('image/png');a.click();}
function finishCard(card,url,fileName,size){card.querySelector('.image-stage').innerHTML=`<img src="${url}" alt="생성된 ${fileName}">`;card.querySelector('.card-foot').innerHTML=`<strong>${card.querySelector('strong').textContent}</strong><button class="download" type="button">${size}px 저장</button>`;card.querySelector('.download').addEventListener('click',()=>downloadSized(url,fileName,size));}
function failCard(card,message){const errorBox=document.createElement('div');errorBox.className='card-error';errorBox.textContent=String(message||'알 수 없는 오류가 발생했습니다.');card.querySelector('.image-stage').replaceChildren(errorBox);card.querySelector('.card-foot span').textContent='실패';}

cancelButton.addEventListener('click',()=>activeRequest?.abort());

form.addEventListener('submit',async e=>{e.preventDefault();const v=values();if(!v.name||!v.archetype||!v.features){alert('이름, 종족/직업, 핵심 특징을 입력해주세요.');return;}activeRequest=new AbortController();generateButton.disabled=true;generateButton.textContent='생성 중…';cancelButton.hidden=false;resultGrid.innerHTML='';emptyState.classList.add('hidden');const cards=v.states.map(([s,l])=>createCard(s,l));try{const response=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json','x-openai-api-key':document.querySelector('#apiKey').value.trim()},body:JSON.stringify({...v,referenceData,prompts:v.states.map(([s,l])=>({state:s,label:l,prompt:statePrompt(v,s,l)}))}),signal:activeRequest.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'생성 요청에 실패했습니다.');data.results.forEach((r,i)=>r.error?failCard(cards[i],r.error):finishCard(cards[i],r.url,r.fileName,v.targetSize));}catch(error){const message=error.name==='AbortError'?'사용자가 생성을 취소했습니다.':error.message;cards.forEach(card=>failCard(card,message));}finally{activeRequest=null;generateButton.disabled=false;generateButton.textContent='전체 상태 생성';cancelButton.hidden=true;}});

fetch('/api/status').then(r=>r.json()).then(data=>{const el=document.querySelector('#apiStatus');el.textContent=data.hasKey?'API 준비됨':'API 키 필요';el.classList.add(data.hasKey?'ready':'warn');}).catch(()=>{const el=document.querySelector('#apiStatus');el.textContent='서버 연결 안 됨';el.classList.add('warn');});
updateGuide();
