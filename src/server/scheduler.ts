import {runWorkspaceDeletions} from './workspace-deletion';
import {dueDateNotifications} from './due-date-notifications';
import {advanceRecurringOccurrence,nextRecurringDueDate,recurringRunAt,createRecurringOccurrence} from './recurring-issues';
import {ensureCycleSchedule,runCycles} from './cycles.ts';
import {runLifecycle} from './lifecycle.ts';
import {refreshTriageResponsibility} from './triage.ts';
import {runUpdateReminders} from './updates.ts';
import {runReminders} from './reminders.ts';
import {runNotificationRetention,runNotificationSnoozes} from './notifications.ts';
import {synchronizeInheritedCycles,teamAncestors} from './team-hierarchy.ts';
import { Repository, type Actor } from './repository.ts';
import { slaStatus, slaNotifications } from './sla.ts';

export class Scheduler {
  repo:Repository;timer?:ReturnType<typeof setInterval>;lastError:string|null=null;
  constructor(repo:Repository){this.repo=repo;}
  start(){this.timer=setInterval(()=>{try{this.tick();this.lastError=null;}catch(error){this.lastError=error instanceof Error?error.message:'Scheduler failed';}},60000);this.timer.unref();}
  close(){if(this.timer)clearInterval(this.timer);}
  tick(now=new Date()){
    runWorkspaceDeletions(this.repo,now);
    const workspaces=this.repo.db.prepare("SELECT data FROM entities WHERE kind='workspaces' AND deleted_at IS NULL").all() as any[];
    for(const row of workspaces){const workspace=JSON.parse(row.data);const owner=this.repo.all('memberships',workspace.id).find(m=>m.role==='owner'&&!m.teamId);if(!owner)continue;const actor:Actor={userId:owner.userId,workspaceId:workspace.id,role:'owner',scopes:['read','write','admin'],system:true,now};
      for(const team of this.repo.all('teams',workspace.id))ensureCycleSchedule(this.repo,actor,team);
      for(const team of this.repo.all('teams',workspace.id).sort((a,b)=>teamAncestors(this.repo,a).length-teamAncestors(this.repo,b).length))if(team.inheritedCycleTeamId&&!team.archivedAt&&!team.retiredAt)synchronizeInheritedCycles(this.repo,{...actor,hierarchySync:true},team);
      runCycles(this.repo,actor,now);
      runUpdateReminders(this.repo,actor,workspace,now);
      runReminders(this.repo,actor,now);
      runNotificationSnoozes(this.repo,actor,now);
      runNotificationRetention(this.repo,actor,now);
      for(const issue of this.repo.all('issues',workspace.id)) {
        const issueTeam=this.repo.raw('teams',issue.teamId);if(issueTeam?.archivedAt||issueTeam?.retiredAt)continue;
        refreshTriageResponsibility(this.repo,actor,issue);
        dueDateNotifications(this.repo,actor,issue,now);
        if(issue.recurrence&&issue.nextRunAt&&Date.parse(issue.nextRunAt)<=now.getTime())this.repo.transaction(()=>{
          const key=`recurrence:${issue.id}:${issue.nextRunAt}`;if(this.repo.db.prepare('SELECT key FROM scheduler_runs WHERE key=?').get(key))return;
          const nextDue=nextRecurringDueDate(issue);
          if(nextDue){
            let due=nextDue,run=recurringRunAt(due,issue.recurrence.timeZone||'UTC');
            while(Date.parse(run)<=now.getTime()){
              due=nextRecurringDueDate({...issue,recurrenceDueDate:due})!;
              run=recurringRunAt(due,issue.recurrence.timeZone||'UTC');
            }
            createRecurringOccurrence(this.repo,actor,issue,due);
            this.repo.update(actor,'issues',issue.id,{recurrenceDueDate:due,nextRunAt:run});
            this.repo.db.prepare('INSERT INTO scheduler_runs VALUES(?,?)').run(key,now.toISOString());
            return;
          }
          createRecurringOccurrence(this.repo,actor,issue,null);
          let date=new Date(issue.nextRunAt);
          do{date=advanceRecurringOccurrence(date,issue.recurrence);}while(date.getTime()<=now.getTime());
          this.repo.update(actor,'issues',issue.id,{nextRunAt:date.toISOString()});this.repo.db.prepare('INSERT INTO scheduler_runs VALUES(?,?)').run(key,now.toISOString());
        });
        if(issue.snoozedUntil&&Date.parse(issue.snoozedUntil)<=now.getTime())this.repo.update(actor,'issues',issue.id,{snoozedUntil:null});
        if(issue.slaDueAt&&!issue.slaBreachedAt&&!issue.completedAt&&Date.parse(issue.slaDueAt)<now.getTime())this.repo.update(actor,'issues',issue.id,{slaBreachedAt:now.toISOString()});
        if(issue.slaDueAt){const status=slaStatus(issue,now.getTime());if(status!==issue.slaStatus)this.repo.update(actor,'issues',issue.id,{slaStatus:status});slaNotifications(this.repo,actor,issue,now);}

      }
      runLifecycle(this.repo,actor,now);
    }
  }
}
