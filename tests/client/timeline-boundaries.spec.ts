import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
test('overlapping timeline milestones remain selectable and gesture zoom keeps its date anchor',async({page})=>{
 test.setTimeout(60000);page.setDefaultTimeout(10000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Planner',email:'timeline-boundary@example.test',password:'timeline-boundary-password'}});
  const data=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:data.user.id,workspaceId:data.workspaceId,role:'owner',scopes:['admin']},today=new Date().toISOString().slice(0,10),project=app.repo.create(actor,'projects',{name:'Dense milestone project',teamIds:[data.teams[0].id],startDate:today,targetDate:today});
  const milestones=['First checkpoint','Second checkpoint','Third checkpoint'].map(name=>app.repo.create(actor,'milestones',{projectId:project.id,name,targetDate:today}));
  await page.goto(url+'/projects');await page.getByRole('button',{name:'Project display options',exact:true}).click();await page.getByRole('button',{name:'Timeline layout',exact:true}).click();await page.keyboard.press('Escape');await page.getByLabel('Timeline scale',{exact:true}).selectOption('week');
  const timeline=page.locator('.feature-timeline'),markers=page.locator('[data-milestone-id]');await expect(markers).toHaveCount(3);await markers.last().click();
  const panel=page.getByRole('dialog',{name:'Milestone details',exact:true}),choices=panel.getByRole('group',{name:'Overlapping milestones',exact:true});await expect(choices.getByRole('button')).toHaveCount(3);
  for(const milestone of milestones){await choices.getByRole('button',{name:milestone.name,exact:true}).click();await expect(panel.locator(':scope > strong')).toHaveText(milestone.name);await expect(page.locator('[data-milestone-id="'+milestone.id+'"]').first()).toHaveAttribute('aria-pressed','true');}
  await page.keyboard.press('Escape');const before=await timeline.evaluate(element=>({start:Number((element as HTMLElement).dataset.timelineStart),span:Number((element as HTMLElement).dataset.timelineSpan)})),anchor=.8;
  await timeline.evaluate((element,anchor)=>{const bounds=element.querySelector('.feature-timeline-track')!.getBoundingClientRect();for(const [type,scale]of [['gesturestart',1],['gesturechange',2],['gestureend',2]] as const){const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{clientX:{value:bounds.left+bounds.width*anchor},scale:{value:scale}});element.dispatchEvent(event)}},anchor);
  await expect(timeline).toHaveAttribute('data-timeline-span',String(before.span/2));const after=await timeline.evaluate(element=>({start:Number((element as HTMLElement).dataset.timelineStart),span:Number((element as HTMLElement).dataset.timelineSpan)}));expect(Math.abs(before.start+before.span*anchor-after.start-after.span*anchor)).toBeLessThan(2);
  await page.getByLabel('Timeline scale',{exact:true}).selectOption('month');const changed=await timeline.evaluate(element=>({start:Number((element as HTMLElement).dataset.timelineStart),span:Number((element as HTMLElement).dataset.timelineSpan)}));expect(changed.start).toBeLessThan(before.start+before.span*anchor);expect(changed.start+changed.span).toBeGreaterThan(before.start+before.span*anchor);
  await page.reload();await expect(timeline).toHaveAttribute('data-timeline-start',String(changed.start));await expect(timeline).toHaveAttribute('data-timeline-span',String(changed.span));
  await page.goto(url+'/project/'+project.id);const graph=page.getByRole('img',{name:/project progress over time/});await expect(page.getByText('Progress appears when this project starts.',{exact:true})).toBeVisible();await expect(graph).toHaveCount(0);
  app.repo.update(actor,'projects',project.id,{status:'started'});await page.reload();await expect(graph).toBeVisible();
  app.repo.update(actor,'projects',project.id,{status:'planned'});await page.reload();await expect(graph).toBeVisible();
  app.repo.update(actor,'projects',project.id,{status:'completed'});await page.reload();await expect(graph).toBeVisible();
 }finally{await page.close();await app.close();}
});
