import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  const searchSchema=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='entity_search'").get() as {sql:string}|undefined;
  const relationIndexExists=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='issue_edges'").get();
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id),workspace_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entities(kind TEXT NOT NULL,id TEXT NOT NULL,workspace_id TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT,PRIMARY KEY(kind,id));
    CREATE INDEX IF NOT EXISTS entity_workspace_kind ON entities(workspace_id,kind,deleted_at,updated_at);
    CREATE INDEX IF NOT EXISTS entity_visibility ON entities(workspace_id,kind,json_extract(data,'$.visibility'));
    CREATE INDEX IF NOT EXISTS entity_private ON entities(workspace_id,kind,json_extract(data,'$.private'));
    CREATE INDEX IF NOT EXISTS entity_priority ON entities(workspace_id,kind,json_extract(data,'$.priority'),deleted_at,updated_at,id);
    CREATE INDEX IF NOT EXISTS entity_created ON entities(workspace_id,kind,deleted_at,created_at,id);
    CREATE INDEX IF NOT EXISTS entity_custom_id ON entities(workspace_id,kind) WHERE length(id)<>36 OR id GLOB '*[^0-9a-f-]*';
    CREATE INDEX IF NOT EXISTS entity_identifier ON entities(workspace_id,kind,json_extract(data,'$.identifier'));
    CREATE INDEX IF NOT EXISTS entity_scan ON entities(workspace_id,kind,id);
    CREATE INDEX IF NOT EXISTS entity_team ON entities(kind,json_extract(data,'$.teamId'),deleted_at);
    CREATE INDEX IF NOT EXISTS entity_parent ON entities(kind,json_extract(data,'$.parentId'),deleted_at);
    CREATE INDEX IF NOT EXISTS entity_status ON entities(workspace_id,kind,json_extract(data,'$.statusId'),deleted_at);
    CREATE INDEX IF NOT EXISTS entity_assignee ON entities(workspace_id,kind,json_extract(data,'$.assigneeId'),deleted_at);
    CREATE INDEX IF NOT EXISTS entity_project ON entities(workspace_id,kind,json_extract(data,'$.projectId'),deleted_at);
    CREATE INDEX IF NOT EXISTS entity_cycle ON entities(workspace_id,kind,json_extract(data,'$.cycleId'),deleted_at);
    CREATE INDEX IF NOT EXISTS entity_user ON entities(workspace_id,kind,json_extract(data,'$.userId'),deleted_at);
    CREATE INDEX IF NOT EXISTS notification_open ON entities(workspace_id,json_extract(data,'$.userId'),coalesce(json_extract(data,'$.deliveredAt'),created_at) DESC,id DESC) WHERE kind='notifications' AND deleted_at IS NULL AND json_extract(data,'$.archivedAt') IS NULL;
    CREATE VIRTUAL TABLE IF NOT EXISTS entity_search USING fts5(kind UNINDEXED,id UNINDEXED,workspace_id UNINDEXED,content,tokenize='porter unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS search_rows(kind TEXT NOT NULL,id TEXT NOT NULL,search_rowid INTEGER NOT NULL,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS api_tokens(id TEXT PRIMARY KEY,hash TEXT UNIQUE NOT NULL,user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,name TEXT NOT NULL,scopes TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT,last_used_at TEXT,app_id TEXT);
    CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT NOT NULL,kind TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,data TEXT,actor_id TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS changes_workspace ON changes(workspace_id,seq);
    CREATE TABLE IF NOT EXISTS mutations(workspace_id TEXT NOT NULL,actor_id TEXT NOT NULL,mutation_id TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(workspace_id,actor_id,mutation_id));
    CREATE TABLE IF NOT EXISTS webhooks(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,creator_id TEXT NOT NULL,url TEXT NOT NULL,secret TEXT NOT NULL,events TEXT NOT NULL,enabled INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS webhook_deliveries(id TEXT PRIMARY KEY,webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,event_id INTEGER NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT NOT NULL,last_status INTEGER,last_error TEXT,delivered_at TEXT,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS webhook_due ON webhook_deliveries(status,next_attempt_at);
    CREATE TABLE IF NOT EXISTS oauth_apps(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,creator_id TEXT NOT NULL,name TEXT NOT NULL,secret_hash TEXT NOT NULL,redirect_uris TEXT NOT NULL,scopes TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_codes(hash TEXT PRIMARY KEY,app_id TEXT NOT NULL,user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,redirect_uri TEXT NOT NULL,scopes TEXT NOT NULL,challenge TEXT,expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,creator_id TEXT NOT NULL,filename TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,entity_kind TEXT,entity_id TEXT,content BLOB NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS issue_attachments(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,issue_id TEXT NOT NULL,url TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(workspace_id,issue_id,url));
    CREATE TABLE IF NOT EXISTS project_attachments(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,project_id TEXT NOT NULL,url TEXT NOT NULL,title TEXT NOT NULL,creator_id TEXT,metadata TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(workspace_id,project_id,url));
    CREATE TABLE IF NOT EXISTS scheduler_runs(key TEXT PRIMARY KEY,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS issue_sequences(team_id TEXT PRIMARY KEY,last_number INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace_permissions(workspace_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS issue_edges(workspace_id TEXT NOT NULL,owner_id TEXT NOT NULL,other_id TEXT NOT NULL,type TEXT NOT NULL,PRIMARY KEY(owner_id,other_id));
    CREATE INDEX IF NOT EXISTS issue_edges_other ON issue_edges(other_id,type,owner_id);
    CREATE TABLE IF NOT EXISTS entity_tombstones(kind TEXT NOT NULL,id TEXT NOT NULL,workspace_id TEXT NOT NULL,access_data TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS comment_deletion_cohorts(workspace_id TEXT NOT NULL,root_id TEXT NOT NULL,root_version INTEGER NOT NULL,comment_id TEXT NOT NULL,deleted_version INTEGER NOT NULL,PRIMARY KEY(root_id,root_version,comment_id));
  `);
  // Rebuild only the derived search index, preserving its row IDs and source entities.
  if(searchSchema&&!searchSchema.sql.includes("porter unicode61")){
    db.exec('BEGIN IMMEDIATE');
    try{db.exec(`CREATE VIRTUAL TABLE entity_search_stemmed USING fts5(kind UNINDEXED,id UNINDEXED,workspace_id UNINDEXED,content,tokenize='porter unicode61 remove_diacritics 2');
      INSERT INTO entity_search_stemmed(rowid,kind,id,workspace_id,content) SELECT rowid,kind,id,workspace_id,content FROM entity_search;
      DROP TABLE entity_search;
      ALTER TABLE entity_search_stemmed RENAME TO entity_search;`);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');db.close();throw error}
  }
  db.exec('INSERT OR IGNORE INTO search_rows(kind,id,search_rowid) SELECT kind,id,rowid FROM entity_search');
  if(!(db.prepare('PRAGMA table_info(issue_attachments)').all() as {name:string}[]).some(column=>column.name==='details'))db.exec("ALTER TABLE issue_attachments ADD COLUMN details TEXT NOT NULL DEFAULT '{}'");
  const webhookColumns=new Set((db.prepare('PRAGMA table_info(webhooks)').all() as {name:string}[]).map(column=>column.name));if(!webhookColumns.has('team_id'))db.exec('ALTER TABLE webhooks ADD COLUMN team_id TEXT');if(!webhookColumns.has('all_public_teams'))db.exec('ALTER TABLE webhooks ADD COLUMN all_public_teams INTEGER NOT NULL DEFAULT 0');
  if(!relationIndexExists)db.exec(`INSERT OR IGNORE INTO issue_edges SELECT e.workspace_id,e.id,json_extract(r.value,'$.issueId'),CASE json_extract(r.value,'$.type') WHEN 'blocking' THEN 'blocks' WHEN 'blocked_by' THEN 'blockedBy' WHEN 'duplicate' THEN 'related' ELSE json_extract(r.value,'$.type') END FROM entities e,json_each(e.data,'$.relations') r WHERE e.kind='issues' AND e.deleted_at IS NULL AND json_extract(r.value,'$.issueId') IS NOT NULL;
    INSERT OR IGNORE INTO issue_edges SELECT e.workspace_id,e.id,r.value,'blocks' FROM entities e,json_each(e.data,'$.blockingIds') r WHERE e.kind='issues' AND e.deleted_at IS NULL;
    INSERT OR IGNORE INTO issue_edges SELECT e.workspace_id,e.id,r.value,'blockedBy' FROM entities e,json_each(e.data,'$.blockedByIds') r WHERE e.kind='issues' AND e.deleted_at IS NULL;
    INSERT OR IGNORE INTO issue_edges SELECT e.workspace_id,e.id,r.value,'related' FROM entities e,json_each(e.data,'$.relatedIds') r WHERE e.kind='issues' AND e.deleted_at IS NULL;`);
  return db;
}
