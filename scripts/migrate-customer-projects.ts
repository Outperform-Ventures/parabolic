import {readFileSync} from 'node:fs';
import {openDatabase} from '../src/server/database';
import {Repository} from '../src/server/repository';
import {linkCustomerProjects,type CustomerProjectMapping} from '../src/server/customer-project-migration';

// Operate on a private backup first. Quit the desktop app before applying to its DB.
const args=process.argv.slice(2),option=(name:string)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1]};
const database=option('--database'),workspaceId=option('--workspace'),userId=option('--actor'),mappingPath=option('--mapping');
if(!database||!workspaceId||!userId||!mappingPath)throw Error('Required: --database PATH --workspace ID --actor ID --mapping PRIVATE_JSON_PATH [--apply]');
const mappings=JSON.parse(readFileSync(mappingPath,'utf8')) as CustomerProjectMapping[];
if(!Array.isArray(mappings))throw Error('Mapping must be an array');
const db=openDatabase(database);
try{
 const repo=new Repository(db),role=repo.role(userId,workspaceId);
 if(role!=='owner')throw Error('Workspace owner required for this migration');
 const result=linkCustomerProjects(repo,{workspaceId,userId,role,scopes:['admin']},mappings,args.includes('--apply'));
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}finally{db.close()}
