import {stemmer} from 'stemmer';
export const searchStopWords=new Set('a an and are as at be but by for if in into is it no not of on or such that the their then there these they this to was will with'.split(' '));
export const searchWords=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const searchCanonical=(value:string)=>searchWords(value).replaceAll(' ','');
export const searchStemWords=(value:string)=>searchWords(value).split(' ').map(word=>/^[a-z]+$/.test(word)?stemmer(word):word).join(' ');
export function searchTokens(query:string){return [...query.matchAll(/"([^"]*)"|(\S+)/g)].map(match=>({value:searchWords(match[1]??match[2]),quoted:match[1]!==undefined})).filter(token=>token.value&&(token.quoted||!searchStopWords.has(token.value))).map(token=>({...token,value:searchStemWords(token.value)}));}
/** FTS Porter-compatible boundaries: unquoted final words are prefixes; quoted phrases match normalized inflections. */
export function matchesStemmedSearchWords(text:string,tokens:{value:string;quoted:boolean}[]){const words=' '+text+' ';return tokens.every(token=>words.includes(' '+token.value+(token.quoted?' ':'')));}
export function matchesSearchTokens(text:string,tokens:{value:string;quoted:boolean}[]){return matchesStemmedSearchWords(searchStemWords(text),tokens);}
export function searchStatusRank(archived:unknown,kind:string,status:string|undefined){return archived?4:kind!=='issues'||['unstarted','started'].includes(status??'')?0:['backlog','triage'].includes(status??'')?1:status==='completed'?2:3;}
