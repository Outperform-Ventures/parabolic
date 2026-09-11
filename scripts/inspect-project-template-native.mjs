import { chromium } from '../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9224');
const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('parabolic.app'));
await page.goto('https://parabolic.app/parabolic/settings/templates/project/new');await page.waitForTimeout(700);
const result=await page.evaluate(()=>{
 const clean=v=>v?.replace(/\s+/g,' ').trim()||'';
 const info=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,role:e.getAttribute('role'),cls:e.className?.toString().slice(0,250),text:clean(e.textContent).slice(0,160),rect:{x:r.x,y:r.y,w:r.width,h:r.height},style:{font:s.font,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,border:s.border,borderRadius:s.borderRadius,padding:s.padding,margin:s.margin,gap:s.gap,boxShadow:s.boxShadow}}};
 const button=n=>[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||clean(e.textContent))===n);
 const input=n=>[...document.querySelectorAll('input,textarea,[contenteditable=true]')].find(e=>e.getAttribute('aria-label')===n||e.getAttribute('placeholder')===n);
 const map={};for(const [key,e] of Object.entries({name:input('Add a descriptive name…'),title:input('Project name'),summary:input('Project summary'),description:input('Project description'),status:button('Change project status'),priority:button('Change project priority'),lead:button('Set project lead'),members:button('Change project members'),teams:button('Change project teams'),labels:button('Change labels'),dependencies:button('Add dependencies'),issues:button('Add issue'),milestones:button('Milestones'),add:button('Add'),visibility:button('Template visibility'),cancel:button('Cancel'),create:button('Create')})){map[key]=[info(e),info(e?.parentElement),info(e?.parentElement?.parentElement),info(e?.parentElement?.parentElement?.parentElement)]}
 return map;
});console.log(JSON.stringify(result,null,2));await browser.close();
