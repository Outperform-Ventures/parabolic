import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('global issue, project, and document creation entrypoints preserve native click and keyboard behavior',async({page})=>{
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});
  const {url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{email:'global-creation@example.test',name:'Creation owner',password:'global-creation-password'}});

    await page.goto(url+'/my-issues');
    const createIssue=page.getByRole('button',{name:'Create new issue',exact:true});
    await createIssue.click();
    await expect(page.locator('.issue-composer')).not.toHaveClass(/expanded/);
    await expect(page.getByLabel('Issue title',{exact:true})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.issue-composer')).toHaveCount(0);

    await page.keyboard.press('c');
    await expect(page.getByLabel('Issue title',{exact:true})).toBeFocused();
    await expect(page.locator('.issue-composer')).not.toHaveClass(/expanded/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('v');
    await expect(page.locator('.issue-composer')).toHaveClass(/expanded/);
    await expect(page.getByLabel('Issue title',{exact:true})).toBeFocused();
    await page.keyboard.press('Escape');

    await page.goto(url+'/projects');
    await page.locator('.feature-header').getByRole('button',{name:'New project',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'New project',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog',{name:'New project',exact:true})).toHaveCount(0);
    await page.keyboard.press('n');
    await page.keyboard.press('p');
    await expect(page.getByRole('dialog',{name:'New project',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog',{name:'New project',exact:true})).toHaveCount(0);

    await page.goto(url+'/documents');
    await page.locator('.feature-header').getByRole('button',{name:'New document',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'New document',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog',{name:'New document',exact:true})).toHaveCount(0);

    await page.keyboard.press('Meta+k');
    const command=page.getByRole('combobox',{name:'Command menu',exact:true});
    for(let index=0;index<4;index++)await command.press('ArrowDown');
    await expect(page.getByRole('option',{name:/Create new document in/})).toHaveAttribute('aria-selected','true');
    await command.press('Enter');
    await expect(page.getByRole('dialog',{name:'New document',exact:true})).toBeVisible();
  }finally{
    await app.close();
  }
});
