-- 0013 — Seed the news feed sources.
--
-- feeds.sync (ANTE-ADMIN §5) and the Fav Team News box shipped complete, but nothing
-- ever gave them a source, so feed_sources was empty and every player's news box read
-- the "quiet day" empty state forever. This seeds it.
--
-- Sources are first-party club RSS (one per team, the same feed the clubs publish for
-- syndication) plus two league wires for the ticker. All keyless and quota-free, on the
-- same criterion D-005 used for sports data: least likely to break or deny access.
-- Google News RSS was rejected — its terms limit it to personal, non-commercial use.
--
-- The commissioner can disable or re-point any row from the admin feeds screen; this
-- migration only fills an empty table and is safe to re-run.

insert into feed_sources (kind, name, url, team_code, enabled, priority)
select 'league_ticker', v.name, v.url, null, true, v.priority
from (values
  ('ESPN NFL', 'https://www.espn.com/espn/rss/nfl/news', 10),
  ('CBS Sports NFL', 'https://www.cbssports.com/rss/headlines/nfl/', 5)
) as v(name, url, priority)
where not exists (select 1 from feed_sources fs where fs.url = v.url);

insert into feed_sources (kind, name, url, team_code, enabled, priority)
select 'team_news', t.city || ' ' || t.name, v.url, t.code, true, 0
from (values
  ('ARI', 'https://www.azcardinals.com/rss/news'),
  ('ATL', 'https://www.atlantafalcons.com/rss/news'),
  ('BAL', 'https://www.baltimoreravens.com/rss/news'),
  ('BUF', 'https://www.buffalobills.com/rss/news'),
  ('CAR', 'https://www.panthers.com/rss/news'),
  ('CHI', 'https://www.chicagobears.com/rss/news'),
  ('CIN', 'https://www.bengals.com/rss/news'),
  ('CLE', 'https://www.clevelandbrowns.com/rss/news'),
  ('DAL', 'https://www.dallascowboys.com/rss/news'),
  ('DEN', 'https://www.denverbroncos.com/rss/news'),
  ('DET', 'https://www.detroitlions.com/rss/news'),
  ('GB', 'https://www.packers.com/rss/news'),
  ('HOU', 'https://www.houstontexans.com/rss/news'),
  ('IND', 'https://www.colts.com/rss/news'),
  ('JAX', 'https://www.jaguars.com/rss/news'),
  ('KC', 'https://www.chiefs.com/rss/news'),
  ('LA', 'https://www.therams.com/rss/news'),
  ('LAC', 'https://www.chargers.com/rss/news'),
  ('LV', 'https://www.raiders.com/rss/news'),
  ('MIA', 'https://www.miamidolphins.com/rss/news'),
  ('MIN', 'https://www.vikings.com/rss/news'),
  ('NE', 'https://www.patriots.com/rss/news'),
  ('NO', 'https://www.neworleanssaints.com/rss/news'),
  ('NYG', 'https://www.giants.com/rss/news'),
  ('NYJ', 'https://www.newyorkjets.com/rss/news'),
  ('PHI', 'https://www.philadelphiaeagles.com/rss/news'),
  ('PIT', 'https://www.steelers.com/rss/news'),
  ('SEA', 'https://www.seahawks.com/rss/news'),
  ('SF', 'https://www.49ers.com/rss/news'),
  ('TB', 'https://www.buccaneers.com/rss/news'),
  ('TEN', 'https://www.tennesseetitans.com/rss/news'),
  ('WAS', 'https://www.commanders.com/rss/news')
) as v(code, url)
join teams t on t.code = v.code
where not exists (select 1 from feed_sources fs where fs.url = v.url);
