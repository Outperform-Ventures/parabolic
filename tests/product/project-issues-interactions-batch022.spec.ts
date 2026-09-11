import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('single-team project issues keep row, menu, navigation, and empty creation interactions in project scope',async({page})=>{
  const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Project issues QA',email:'project-issues-batch22@example.test',password:'project-issues-password'}});
    const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),firstTeam=state.teams[0];
    const secondTeam=await page.request.post(url+'/api/v1/teams',{data:{name:'Project team',key:'PRJ'}}).then(response=>response.json());
    const refreshed=await page.request.get(url+'/api/v1/state').then(response=>response.json()),started=refreshed.statuses.find((status:any)=>status.teamId===secondTeam.id&&status.type==='started');
    const project=await page.request.post(url+'/api/v1/projects',{data:{name:'Interaction project',teamIds:[secondTeam.id]}}).then(response=>response.json());
    const issue=await page.request.post(url+'/api/v1/issues',{data:{title:'Interactive project issue',teamId:secondTeam.id,projectId:project.id,statusId:started.id,priority:2,estimate:4}}).then(response=>response.json());

    await page.goto(url+'/project/'+project.id+'/issues');
    const row=page.locator(`[data-issue-id="${issue.id}"]`),checkbox=row.getByRole('button',{name:`Select ${issue.identifier}`,exact:true});
    await expect(checkbox).toHaveCSS('opacity','0');
    await row.hover();
    await expect(checkbox).toHaveCSS('opacity','1');

    await row.getByRole('button',{name:'Change priority',exact:true}).click();
    await expect(page.locator('[data-property-menu=priority]')).toBeVisible();
    await page.keyboard.press('Escape');
    await row.getByRole('button',{name:'Change status',exact:true}).click();
    const statusMenu=page.locator('[data-property-menu=statusId]');
    await expect(statusMenu).toBeVisible();
    await expect(statusMenu.locator('.menu-scroll>.menu-item')).toHaveCount(refreshed.statuses.filter((status:any)=>status.teamId===secondTeam.id&&!status.deletedAt&&!status.archivedAt).length);
    await page.keyboard.press('Escape');
    await row.getByRole('button',{name:'Change estimate',exact:true}).click();
    await expect(page.locator('[data-property-menu=estimate]')).toBeVisible();
    await page.keyboard.press('Escape');

    await row.click({button:'right'});
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem',{name:'Status',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await row.locator('.issue-row-title').click();
    await expect(page).toHaveURL(url+'/issues/'+issue.id);
    await page.goBack();
    await expect(row).toBeVisible();

    await page.getByRole('button',{name:'Filter issues',exact:true}).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Display options',exact:true}).click();
    await expect(page.getByRole('tablist',{name:'Issue layout'})).toBeVisible();
    await page.keyboard.press('Escape');

    const emptyProject=await page.request.post(url+'/api/v1/projects',{data:{name:'Empty scoped project',teamIds:[secondTeam.id]}}).then(response=>response.json());
    await page.goto(url+'/project/'+emptyProject.id+'/issues');
    await expect(page.locator('[data-issue-id]')).toHaveCount(0);
    await page.getByRole('button',{name:'Display options',exact:true}).click();
    await page.getByLabel('Show empty groups',{exact:true}).check();
    await page.keyboard.press('Escape');
    await page.locator('.group-header').filter({hasText:started.name}).getByRole('button',{name:'Create new issue',exact:true}).click();
    const composer=page.locator('.issue-composer');
    await expect(composer.getByRole('button',{name:'Change team',exact:true})).toContainText(secondTeam.key);
    await composer.locator('.issue-title-input').fill('Created from empty project');
    await composer.getByRole('button',{name:'Create issue',exact:true}).click();
    await expect.poll(async()=>page.request.get(url+'/api/v1/state').then(response=>response.json()).then(next=>next.issues.find((item:any)=>item.title==='Created from empty project'))).toMatchObject({teamId:secondTeam.id,projectId:emptyProject.id});
    expect(firstTeam.id).not.toBe(secondTeam.id);
  }finally{
    await page.close();
    await app.close();
  }
});
