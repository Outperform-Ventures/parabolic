import{test,expect}from'@playwright/test';
import{createApp}from'../../src/server/app';
import{resolve}from'node:path';

test.use({serviceWorkers:'block',colorScheme:'dark'});

test('team issue chrome matches native tabs, toolbar inventory and direct row focus link',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Team chrome owner',email:'team-chrome@example.test',password:'team-chrome-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{triageEnabled:true}});
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Native focus link',teamId:team.id}})).json();
  await page.setViewportSize({width:1777,height:991});
  await page.goto(url+'/team/'+team.id+'/all');

  const header=page.locator('.page-header'),toolbar=page.locator('.view-toolbar'),tabs=toolbar.locator('.team-issue-tabs');
  await expect(header.getByRole('button',{name:'New issue',exact:true})).toHaveCount(0);
  await expect(toolbar.getByRole('button',{name:'Toggle insights',exact:true})).toHaveCount(0);
  await expect(toolbar.getByRole('button',{name:'Filter issues',exact:true})).toBeVisible();
  await expect(toolbar.getByRole('button',{name:'Display options',exact:true})).toBeVisible();
  await expect(toolbar.getByRole('button',{name:'Open details',exact:true})).toBeVisible();
  await expect(tabs.getByRole('link',{name:'Active',exact:true})).toHaveCSS('border-radius','9999px');
  expect(await tabs.getByRole('link',{name:'Active',exact:true}).evaluate(node=>getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await expect(tabs.getByRole('link',{name:'All issues',exact:true})).toHaveClass(/active/);

  const row=page.locator(`[data-testid="issue-row"][data-issue-id="${issue.id}"]`),link=row.getByRole('link',{name:`Open ${issue.identifier} ${issue.title}`,exact:true});
  await expect(row).toHaveAttribute('tabindex','-1');
  await expect(link).toHaveAttribute('href',`/issues/${issue.id}`);
  await link.focus();
  await expect(link).toBeFocused();
  await expect(row).toHaveClass(/focused/);
  const rowBox=await row.boundingBox(),linkBox=await link.boundingBox();
  expect(linkBox).toEqual(rowBox);
  await row.getByRole('button',{name:`Select ${issue.identifier}`,exact:true}).click();
  await expect(page).toHaveURL(url+'/team/'+team.id+'/all');
  await expect(row).toHaveAttribute('aria-selected','true');
  await link.focus();await link.press('Enter');
  await expect(page).toHaveURL(url+'/issues/'+issue.id);
 }finally{await page.close();await app.close()}
});
