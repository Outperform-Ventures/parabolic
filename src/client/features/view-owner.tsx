import {useParams} from 'react-router-dom';
import React from 'react';
import {Avatar} from '../components/ui';
import {FeaturePropertyPicker} from './property-picker';
import {Property,optionList,useActions,type Row} from './shared';
export function ViewOwner({view,compact=false}:{view:Row;compact?:boolean}){const {data,update,act}=useActions();const owner=data.users.find(user=>user.id===(view.ownerId||view.creatorId));return <div aria-label={'View owner '+view.name}>{compact?<FeaturePropertyPicker label="Owner" values={[owner?.id||'']} options={optionList(data.users).filter(option=>option.value)} onChange={values=>void act(()=>update('views',view.id,{ownerId:values[0]}))} triggerContent={<><Avatar user={owner} size={16}/><span>{owner?.name||'No owner'}</span></>} triggerLabel="Change view owner" triggerClassName="directory-owner-trigger"/>:<Property label="Owner" value={view.ownerId||view.creatorId} options={optionList(data.users).filter(option=>option.value)} onChange={ownerId=>void act(()=>update('views',view.id,{ownerId}))}/>}</div>}

export function CurrentViewOwner(){const {viewId}=useParams(),{data}=useActions(),view=data.views.find(view=>view.id===viewId);return view?<ViewOwner view={view}/>:null}
