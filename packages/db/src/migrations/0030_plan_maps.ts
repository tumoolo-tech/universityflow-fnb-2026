/**
 * Migration 0030: My plan maps, the learner's mind maps under My goal
 * (docs/design/plan-maps-proposal.md, approved by the owner 2026-10-23). 0029 is the profile
 * photo, built beside this one. Append-only.
 */
export const sql = `-- A map is a template id and, at most, a title in the learner's words. Its parts are a tree:
-- one centre (no parent, depth 0), then up to three levels below it. A part may be a template's
-- slot (\`slot:<key>\`, its words in packages/content) or the learner's own. Ids, statuses and
-- the learner's words only: nothing about a course is kept here (the centre reads My goal live).
-- Both tables go with the account (on delete cascade) and are in Download my data.
create table plan_maps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  template_id text not null check (template_id ~ '^[a-z0-9-]{1,40}$'),
  title text check (title is null or char_length(title) between 1 and 60),
  links_goal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_maps_student on plan_maps (student_id, created_at);

create table plan_map_nodes (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references plan_maps (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  parent_id uuid references plan_map_nodes (id) on delete cascade,
  depth smallint not null check (depth between 0 and 3),
  position smallint not null check (position between 0 and 59),
  slot_id text check (slot_id ~ '^slot:[a-z0-9-]{1,40}$'),
  text text check (text is null or char_length(text) between 1 and 120),
  status text not null default 'planned' check (status in ('planned', 'achieved', 'not-achieved')),
  why_not text check (why_not is null or char_length(why_not) between 1 and 500),
  differently text check (differently is null or char_length(differently) between 1 and 500),
  -- The learner's own aim ("My target"), a month: never a real deadline.
  target_month date check (
    target_month is null
    or (extract(day from target_month) = 1 and extract(year from target_month) between 2020 and 2040)
  ),
  status_changed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_map_nodes_centre check ((parent_id is null) = (depth = 0)),
  constraint plan_map_nodes_place unique (map_id, parent_id, position) deferrable initially deferred
);
create unique index plan_map_nodes_one_centre on plan_map_nodes (map_id) where parent_id is null;
create index plan_map_nodes_map on plan_map_nodes (map_id, parent_id, position);
create index plan_map_nodes_parent on plan_map_nodes (parent_id);
create index plan_map_nodes_student on plan_map_nodes (student_id);

-- Free text never keeps an ID or student number (A11-17's rule, migration 0021).
alter table plan_map_nodes add constraint plan_map_nodes_no_personal_number check (
  not uf_holds_personal_number(
    coalesce(text, '') || ' ' || coalesce(why_not, '') || ' ' || coalesce(differently, '')
  )
);
alter table plan_maps add constraint plan_maps_no_personal_number check (
  not uf_holds_personal_number(coalesce(title, ''))
);

-- The learner's own words (a title, a part's text, what got in the way, what to try differently)
-- need consent wording that names plan maps: guardian consent v4 and adult-v3, which are drafts
-- owed legal review (packages/content planMaps.consentDraft). No live wording names them yet, so
-- until a later migration names the versions that do, words are refused for every learner.
-- The one exception is the owner's preview: the server sets uf.plan_words to 'preview' for the
-- one transaction when UF_MINDMAP_WORDS=1, a switch the web app refuses in production. Choosing a
-- template, ticking a status, ordering and the learner's target month need only uf_may_process.
-- Clearing words is always allowed.
create function uf_plan_words_allowed() returns boolean
  language sql stable set search_path = public as $$
  select coalesce(current_setting('uf.plan_words', true), '') = 'preview'
$$;
grant execute on function uf_plan_words_allowed() to uf_app;

create function uf_plan_node_words_allowed() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (new.text is not null or new.why_not is not null or new.differently is not null)
    and not uf_plan_words_allowed() then
    raise exception 'The learner''s consent does not cover their own words in a plan map'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger plan_map_nodes_words_allowed
  before insert or update of text, why_not, differently on plan_map_nodes
  for each row execute function uf_plan_node_words_allowed();

create function uf_plan_map_words_allowed() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.title is not null and not uf_plan_words_allowed() then
    raise exception 'The learner''s consent does not cover their own words in a plan map'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger plan_maps_words_allowed before insert or update of title on plan_maps
  for each row execute function uf_plan_map_words_allowed();

-- The limits (D8), held here as well as in the store: 10 maps a learner; 60 parts a map, 12
-- under any one part; a part sits one level below its parent, in the same map and the same
-- learner's. Read as the learner (row-level security): their own rows are the ones that count.
create function uf_plan_map_limit() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (select count(*) from plan_maps where student_id = new.student_id) >= 10 then
    raise exception 'A learner keeps at most 10 plan maps' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger plan_maps_limit before insert on plan_maps
  for each row execute function uf_plan_map_limit();

create function uf_plan_node_shape() returns trigger
  language plpgsql set search_path = public as $$
declare
  parent record;
begin
  if not exists (select 1 from plan_maps m where m.id = new.map_id and m.student_id = new.student_id) then
    raise exception 'A part belongs to its own learner''s map' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT'
    and (select count(*) from plan_map_nodes where map_id = new.map_id) >= 60 then
    raise exception 'A plan map holds at most 60 parts' using errcode = 'check_violation';
  end if;
  if new.parent_id is not null then
    select p.map_id, p.depth into parent from plan_map_nodes p where p.id = new.parent_id;
    if not found or parent.map_id <> new.map_id or new.depth <> parent.depth + 1 then
      raise exception 'A part sits one level below its parent, in the same map'
        using errcode = 'check_violation';
    end if;
    if (tg_op = 'INSERT' or old.parent_id is distinct from new.parent_id)
      and (select count(*) from plan_map_nodes where parent_id = new.parent_id) >= 12 then
      raise exception 'A part holds at most 12 parts under it' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end
$$;
create trigger plan_map_nodes_shape before insert or update of map_id, student_id, parent_id, depth
  on plan_map_nodes for each row execute function uf_plan_node_shape();

alter table plan_maps enable row level security;
alter table plan_map_nodes enable row level security;
create policy plan_maps_consented_self on plan_maps
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
create policy plan_map_nodes_consented_self on plan_map_nodes
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on plan_maps, plan_map_nodes to uf_app;
`;
