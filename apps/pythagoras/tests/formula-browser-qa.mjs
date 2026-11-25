import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const url=process.env.PYTHAGORAS_QA_URL||'http://127.0.0.1:4186/pythagoras/';
const browser=await chromium.launch({channel:'msedge'});
const page=await browser.newPage({viewport:{width:1920,height:1080},offline:url.startsWith('file:')});
const encodingDamage=/[\x00-\x08\x0B-\x1F\uFFFD]|sinalpha|sinbeta|quad|cdot|riangle|rac/u;
const expectations=new Map([
 ['5:5',{symbols:/△/,fractions:1}],
 ['5:8',{symbols:/△/,fractions:1}],
 ['11:4',{symbols:/⋅/,fractions:1}],
 ['13:5',{symbols:/⋅/}],
 ['14:2',{symbols:/sinα.*sinβ/,fractions:2}],
 ['14:4',{symbols:/sinα/}],
 ['14:5',{symbols:/sinβ/}],
 ['15:4',{symbols:/⋅/}],
]);

try {
  await page.goto(url);
  const chooser=page.getByRole('combobox',{name:'切换证明',exact:true});
  const modules=await chooser.locator('option').evaluateAll(options=>options.map(option=>option.value));
  const ribbon=page.locator('.formula-ribbon');
  let steps=0,formulas=0;
  async function checkFormula(location,expected) {
    const buttons=ribbon.locator('.math-formula');
    assert.equal(await buttons.locator('.katex-error').count(),0,location);
    for(const formula of await buttons.all()) {
      assert.equal(await formula.locator('.katex-html').count(),1,location);
      const text=(await formula.textContent()).replace(/\u200b/g,'');
      assert.doesNotMatch(text,encodingDamage,location);
      if(expected?.symbols)assert.match(text,expected.symbols,location);
      if(expected?.fractions)assert.equal(await formula.locator('.mfrac').count(),expected.fractions,location);
      formulas++;
    }
    if(expected)assert.equal(await buttons.count(),1,location);
    steps++;
  }
  const stepButtons=page.locator('.step-list button');
  for(const module of modules.filter(id=>id!=='free')) {
    await chooser.selectOption(module);
    const tag=await page.locator('.stage-heading .eyebrow').textContent();
    const videoNumber=Number(tag.match(/证明 (\d+)/)?.[1]);
    const count=await stepButtons.count();
    for(let index=0;index<count;index++) {
      await stepButtons.nth(index).click();
      await checkFormula(module+' step '+(index+1),expectations.get(videoNumber+':'+(index+1)));
      if(videoNumber===14&&index===1&&process.env.PYTHAGORAS_FORMULA_SCREENSHOT){
        await ribbon.screenshot({path:process.env.PYTHAGORAS_FORMULA_SCREENSHOT});
      }
    }
  }
  await chooser.selectOption('free');
  for(const [index,button] of (await page.locator('.experiment-list button').all()).entries()){
    await button.click();
    if(index===5){
      for(const angle of [60,90,120]){
        await page.getByRole('button',{name:angle+'°',exact:true}).click();
        await checkFormula('free experiment 6 at '+angle+'°');
      }
    }else await checkFormula('free experiment '+(index+1));
  }
  assert.equal(modules.length,21);
  assert(formulas>50);
  console.log('Verified '+formulas+' rendered formulas across '+steps+' steps and experiment states.');
} finally {
  await browser.close();
}
