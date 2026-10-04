import { chromium, devices } from '@playwright/test'
const b = await chromium.launch()
for (const [name,opts] of [['desktop',{viewport:{width:1440,height:900}}],['pixel7',{...devices['Pixel 7']}]]) {
const ctx = await b.newContext(opts)
const p = await ctx.newPage()
await p.goto('http://localhost:3200/de', { waitUntil: 'load' })
await p.waitForTimeout(2500)
const h = await p.evaluate(()=>document.documentElement.scrollHeight)
for (let y=0;y<h;y+=300){ await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y); await p.waitForTimeout(120)}
await p.waitForTimeout(800)
console.log(name, await p.evaluate(()=>{let t=0,pb=0;for(const s of document.querySelectorAll('svg')){if(s.parentElement?.closest('svg'))continue;t+=s.outerHTML.length}for(const q of document.querySelectorAll('path'))pb+=(q.getAttribute('d')||'').length;return [t,pb]}))
await ctx.close()
}
await b.close()
