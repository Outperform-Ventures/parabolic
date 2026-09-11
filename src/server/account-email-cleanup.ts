import type {Repository} from './repository';
/** Called only after the account has no remaining workspace identity. */
export function removeAccountEmailConfirmations(repo:Repository,userId:string){
 const exists=(name:string)=>!!repo.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name),hasMail=exists('mail_outbox');
 if(exists('account_email_changes')){for(const row of repo.db.prepare('SELECT id FROM account_email_changes WHERE user_id=?').all(userId) as {id:string}[])if(hasMail)repo.db.prepare('DELETE FROM mail_outbox WHERE instr(dedupe_key,?)=1').run('email-change:'+row.id+':');repo.db.prepare('DELETE FROM account_email_changes WHERE user_id=?').run(userId);}
 if(exists('account_domain_verifications'))repo.db.prepare('DELETE FROM account_domain_verifications WHERE user_id=?').run(userId);
 if(hasMail)repo.db.prepare('DELETE FROM mail_outbox WHERE instr(dedupe_key,?)=1').run('domain-verification:'+userId+':');
}
