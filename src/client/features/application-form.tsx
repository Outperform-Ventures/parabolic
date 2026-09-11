import React,{useState} from 'react';
import {useAppStore} from '../store';
import {FormDialog,MultipleProperty,live} from './shared';

export function ApplicationForm({application,onClose,onSave}:{application?:Record<string,any>;onClose:()=>void;onSave:(fields:Record<string,any>)=>Promise<unknown>}){
  const {data}=useAppStore(),[teamIds,setTeamIds]=useState<string[]>(application?.teamIds??[]);
  return <FormDialog title={application?'Edit application':'New application'} submit={application?'Save changes':'Create'} initial={{name:application?.name??'',redirectUris:application?.redirectUris?.join('\n')??'',scopes:application?.scopes?.join(',')??'read',clientCredentialsEnabled:application?.clientCredentialsEnabled??false,allPublicTeams:application?.allPublicTeams??true}} fields={[
    {key:'name',label:'Application name',required:true},
    {key:'redirectUris',label:'Redirect URLs (one per line)',type:'textarea',placeholder:'https://your-app.example/callback'},
    {key:'scopes',label:'Permissions',required:true,placeholder:'read,write or issues:read,issues:write'},
    {key:'clientCredentialsEnabled',label:'Enable client credentials',type:'checkbox'},
    {key:'allPublicTeams',label:'Access all public teams',type:'checkbox'},
  ]} onClose={onClose} onSave={fields=>onSave({...fields,redirectUris:fields.redirectUris.split('\n').map((value:string)=>value.trim()).filter(Boolean),scopes:fields.scopes.split(/[ ,]+/).filter(Boolean),teamIds})}>
    <MultipleProperty label="Additional teams" values={teamIds} options={live(data.teams).map(team=>({value:team.id,label:team.name}))} onChange={setTeamIds}/>
    <p className="muted">Application installations and client credentials act as a dedicated application identity. Choose its team access here. Client credentials last 30 days and do not include refresh tokens. OAuth redirects are required unless client credentials are enabled.</p>
  </FormDialog>;
}
