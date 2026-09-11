import {useEffect,useMemo} from 'react';
import {useLocation,useParams} from 'react-router-dom';
import {IssueList,IssuePage} from './issues';
import {SearchPage} from './search';
import {useAppStore} from './store';
import {resolveSelectedIssues,selectedIssueTokens} from './selected-issue-list';

// A list link selects records; it never grants access to them.
export function SelectedIssueRoute(){
  const {issueId=''}=useParams(),location=useLocation(),store=useAppStore(),isList=issueId.includes(','),searchPreview=(location.state as {searchPreview?:{search?:string;selectedId?:string}}|null)?.searchPreview;
  const ids=useMemo(()=>resolveSelectedIssues(issueId,store.data.issues),[issueId,store.data.issues]);
  useEffect(()=>{
    if(!isList)return;
    // Resolve archived or previously renamed issues not included in the initial sync.
    // Each lookup uses the ordinary authenticated entity permission boundary.
    void Promise.allSettled(selectedIssueTokens(issueId).map(id=>store.loadEntity('issues',id)));
  },[issueId,isList]);
  if(!isList&&searchPreview?.selectedId===issueId&&searchPreview.search)return <SearchPage previewId={issueId} initialSearch={searchPreview.search}/>;
  return isList?<IssueList key={issueId} issueIds={ids} section="all"/>:<IssuePage/>;
}
