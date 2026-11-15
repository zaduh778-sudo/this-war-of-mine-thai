/** Cloudflare Worker: This War of Mine card translation API.
 * Secret: OPENAI_API_KEY (Cloudflare Worker secret, NEVER in HTML).
 * Variable: ALLOWED_ORIGIN = https://YOURNAME.github.io
 * Optional: MODEL = gpt-4o-mini
 * Deploy this worker separately, then paste its HTTPS URL in the website.
 * WARNING: public worker can incur API charges; add Cloudflare rate limiting / access protection.
 */
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&origin===allowed)headers['Access-Control-Allow-Origin']=origin;
  const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers});
  if(request.method==='OPTIONS'){
   if(origin!==allowed)return reply({error:'Origin not allowed'},403);
   return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}});
  }
  if(request.method!=='POST')return reply({error:'POST only'},405);
  if(!allowed||origin!==allowed)return reply({error:'Origin not allowed'},403);
  if(!env.OPENAI_API_KEY)return reply({error:'Server secret OPENAI_API_KEY not configured'},503);
  const size=Number(request.headers.get('content-length')||0);if(size>4500000)return reply({error:'Request too large'},413);
  let body;try{body=await request.json()}catch(e){return reply({error:'Invalid JSON'},400)}
  const text=typeof body.text==='string'?body.text.slice(0,12000):'';
  const image=typeof body.image==='string'?body.image:'';
  if(image&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))return reply({error:'Only JPEG data URL supported'},400);
  if(image.length>3500000)return reply({error:'Image too large'},413);
  if(!text&&!image)return reply({error:'No card image or text'},400);
  const content=[{type:'text',text:'Read the This War of Mine board game card carefully. Extract the exact English card text (including all numbers and conditional effects) and translate into clear concise Thai suitable for playing. Do not invent unseen text. Return ONLY a JSON object with keys title, english, translation, howToPlay, warning (strings). translation must preserve all gameplay rules, numbers, choices, symbols, and conditions. howToPlay is a brief Thai explanation of how to resolve the card. warning mentions any blurry/uncertain text, or empty string if none. Input typed English: '+text}];
  if(image)content.push({type:'image_url',image_url:{url:image,detail:'high'}});
  let upstream;
  try{upstream=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.MODEL||'gpt-4o-mini',temperature:0.1,response_format:{type:'json_object'},messages:[{role:'user',content}],max_tokens:1800})});}
  catch(e){return reply({error:'AI service connection failed'},502)}
  if(!upstream.ok)return reply({error:'AI service error (HTTP '+upstream.status+')'},502);
  let obj;try{const result=await upstream.json();obj=JSON.parse(result.choices[0].message.content)}catch(e){return reply({error:'AI response format invalid'},502)}
  return reply({title:String(obj.title||''),english:String(obj.english||''),translation:String(obj.translation||''),howToPlay:String(obj.howToPlay||''),warning:String(obj.warning||'')});
 }
};
