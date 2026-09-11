import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildSchema,isObjectType,isInputObjectType,isInterfaceType,isEnumType,isUnionType,valueFromASTUntyped} from 'graphql';
import {buildApiSchema} from '../src/server/graphql';
import type {Repository} from '../src/server/repository';
const raw=await readFile('reference/parabolic-api/schema.graphql','utf8'),provenance=JSON.parse(await readFile('reference/parabolic-api/schema-provenance.json','utf8'));
assert.equal(createHash('sha256').update(raw).digest('hex'),provenance.sha256);
const upstream=buildSchema(raw),local=buildApiSchema({} as Repository);
const scoped=JSON.parse(await readFile(process.argv[2]??'audit/api-contracts-current/customer-contracts.json','utf8'));
const scopes=new Map<string,any>(scoped.rows.map((row:any)=>[row.id,row]));
const scopeRules=JSON.parse(await readFile('audit/api-contracts/scope-rules.json','utf8'));
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const defaultValue=(field:any)=>field.default?.literal?valueFromASTUntyped(field.default.literal):field.default&&Object.hasOwn(field.default,'value')?field.default.value:field.defaultValue;
function declarations(schema:typeof upstream){const rows=new Map<string,any>();
 for(const type of Object.values(schema.getTypeMap()).sort((a,b)=>a.name.localeCompare(b.name))){if(type.name.startsWith('__'))continue;
 const kind=type.constructor.name,shape:any={kind};
 if(isObjectType(type)||isInterfaceType(type))shape.interfaces=type.getInterfaces().map(t=>t.name).sort();
 if(isUnionType(type))shape.members=type.getTypes().map(t=>t.name).sort();
 rows.set(type.name,{signature:shape,description:type.description??'',unit:'type'});
 if(isObjectType(type)||isInputObjectType(type)||isInterfaceType(type))for(const field of Object.values(type.getFields())){
 const signature:any={type:String(field.type)};
 if('args' in field)signature.arguments=Object.fromEntries(field.args.map(arg=>[arg.name,{type:String(arg.type),defaultValue:defaultValue(arg)}]));
 else signature.defaultValue=defaultValue(field);
 rows.set(type.name+'.'+field.name,{signature,description:field.description??'',unit:'field'});
 }
 if(isEnumType(type))for(const value of type.getValues())rows.set(type.name+'.'+value.name,{signature:{enumValue:value.name},description:value.description??'',unit:'enum-value'});
 }
 return rows;
}
const expected=declarations(upstream),actual=declarations(local);
for(const id of [...Object.keys(scopeRules.types),...Object.keys(scopeRules.fields)])assert.ok(expected.has(id),'Scope rule references a missing declaration: '+id);
const rows=[...expected].map(([id,value])=>{const other=actual.get(id),reviewed=scopeRules.fields[id]??scopes.get(id)??scopeRules.types[id.split('.')[0]];return {id,...value,localSignature:other?.signature??null,status:!other?'missing':JSON.stringify(canonical(value.signature))===JSON.stringify(canonical(other.signature))?'signature-matches-behavior-unverified':'signature-mismatch',scope:reviewed?.scope??'pending-scope-review',scopeReason:reviewed?.scopeReason??reviewed?.reason??'Raw declaration inventory only. Apply accepted exclusions by behavior before including this declaration in retained counts; no default exclusion is inferred.'};});
const counts={declarations:rows.length,...Object.fromEntries(['missing','signature-mismatch','signature-matches-behavior-unverified'].map(status=>[status,rows.filter(row=>row.status===status).length])),scopeReviewed:rows.filter(row=>row.scope!=='pending-scope-review').length,pendingScopeReview:rows.filter(row=>row.scope==='pending-scope-review').length};
const scopeCounts=Object.fromEntries(['retained','scaffolding','deferred','excluded','pending-scope-review'].map(scope=>{const group=rows.filter(row=>row.scope===scope);return [scope,{declarations:group.length,...Object.fromEntries(['missing','signature-mismatch','signature-matches-behavior-unverified'].map(status=>[status,group.filter(row=>row.status===status).length]))}]}));
const output='audit/api-contracts/full-schema';await mkdir(output,{recursive:true});
await writeFile(output+'/inventory.json',JSON.stringify({generatedAt:new Date().toISOString(),upstream:provenance,scopeRulesPath:'audit/api-contracts/scope-rules.json',scopeRulesSha256:createHash('sha256').update(await readFile('audit/api-contracts/scope-rules.json')).digest('hex'),localGraphqlSha256:createHash('sha256').update(await readFile('src/server/graphql.ts')).digest('hex'),limitations:'Raw API declaration coverage, including excluded/deferred features. Not a retained feature denominator or runtime/SDK/webhook parity proof. Extra local declarations are not counted. Scalar behavior is not established by its name. Scope review is explicit and incomplete.',counts,scopeCounts,rows},null,2)+'\n');
const columns=['id','unit','status','scope','signature','localSignature','description','scopeReason'];await writeFile(output+'/inventory.tsv',[columns.join('\t'),...rows.map(row=>columns.map(key=>{const value=(row as any)[key];return (typeof value==='object'?JSON.stringify(value):String(value??'')).replace(/[\t\r\n]+/g,' ')}).join('\t'))].join('\n')+'\n');
await writeFile(output+'/README.md',`# Entire published API declaration inventory\n\n${counts.declarations} declarations across all public-schema types, fields, enum values and root operations were compared to current source. ${counts.missing} are absent, ${counts['signature-mismatch']} have signature differences, and ${counts['signature-matches-behavior-unverified']} match declarations without proving behavior. Arguments, defaults, nullability, type kinds, interfaces and union members are compared; argument order is irrelevant.\n\n**These raw counts include excluded and deferred features. Do not use them as a retained feature count or completion percentage.** ${counts.scopeReviewed} declarations have explicit scope decisions from the customer checklist and reviewed type/field rules; ${counts.pendingScopeReview} still require behavioral scope review. Shared types must not be excluded solely because one excluded operation uses them.\n\n| Scope | Declarations | Missing | Different signature | Matching, behavior unverified |\n| --- | ---: | ---: | ---: | ---: |\n${Object.entries(scopeCounts).map(([scope,c])=>'| '+scope+' | '+c.declarations+' | '+c.missing+' | '+c['signature-mismatch']+' | '+c['signature-matches-behavior-unverified']+' |').join('\n')}\n\n[Full TSV](inventory.tsv) · [JSON and provenance](inventory.json) · [Explicit scope rules](../scope-rules.json) · [Retained capability ledger](../../completion-ledger/README.md) · [Accepted scope](../../../scope.json).\n\nThis reveals declaration gaps outside the earlier customer-only comparison. It does not finish the native UI audit, verify scalar behavior, execute operations, compare the complete SDK, or establish webhook compatibility. Reproduce with \`node --import tsx scripts/audit-api-schema.ts\`.\n`);
console.log(JSON.stringify(counts,null,2));
