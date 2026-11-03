# SL open APIs: research notes (tested 2026-11-03, ~22:00 local)

Legend: **[LIVE]** = verified with curl today. **[DOCS]** = read in Trafiklab docs / OpenAPI spec only.

## Sources
- Docs pages (they moved; `/api/our-apis/sl/*` gives a meta-refresh redirect to `/api/other-apis/sl/*`):
  - https://www.trafiklab.se/api/other-apis/sl/transport/
  - https://www.trafiklab.se/api/other-apis/sl/deviations/
  - https://www.trafiklab.se/api/other-apis/sl/journey-planner-2/
- OpenAPI specs (these are what the doc pages embed; plain JSON, curl works):
  - https://www.trafiklab.se/openapi/sl-transport.json (server `https://transport.integration.sl.se/v1`)
  - https://www.trafiklab.se/openapi/sl-deviations.json
  - https://www.trafiklab.se/openapi/sl-journey-planner.json (title "Reseplanerare V3", but paths are under /v2)
- Docs source on GitHub: github.com/trafiklab/trafiklab.se, content/api/other-apis/sl/{transport,deviations,journey-planner-2}.md
- Probing `/v1/api-docs`, `/v3/api-docs`, `/openapi.json`, `/swagger-ui` on the API hosts gives 404/403. Use the trafiklab.se/openapi files instead.
- I found no other keyless SL API. "Trafiklab Stop Lookup", "Trafiklab Realtime" and ResRobot (including Nearby stops) all need a key. The old SL "Stop lookup"/"Nearby stops" APIs are replaced by these.

## Usage rules and rate limits
- [DOCS] Transport and Journey Planner: no key, "should not make excessive requests". Use GTFS Regional for bulk data.
- [DOCS] Deviations: "no quota levels. Fair use rules apply however, and you should only make a request once a minute." So cache for about 60 s.
- [DOCS] Journey Planner: optional headers `X-Correlation-Id` and `User-Contact-Information` (an e-mail address, used to notify about version changes). I did not send them.
- [LIVE] **Transport API returns HTTP 429 `{"error":"Quota has been exceeded"}` intermittently.** It comes from CloudFront and has no Retry-After header. In a burst of 25 sequential requests (~5 req/s) about 1 in 8 failed. Some single requests after a pause of a few seconds also got 429, right after heavy /sites calls. **The client must retry on 429 with backoff (for example 300 ms, then 1 s), cache /sites, and never fan out.** Journey Planner and Deviations never returned 429 in my tests (~100 stop-finder calls at about 5/s).

---
## 1. Transport API: https://transport.integration.sl.se/v1

| Endpoint | Status | Size | Time |
|---|---|---|---|
| `GET /sites?expand=false` | [LIVE] 200 | 1.35 MB (328 KB with `Accept-Encoding: gzip`), 6 503 sites | 0.6-1.0 s |
| `GET /sites?expand=true` | [LIVE] 200 | 1.61 MB (adds `stop_areas: [ids]`) | 3.7 s |
| `GET /sites?name=slussen` | [LIVE] **ignored**, returns the full 1.35 MB list | | |
| `GET /sites/9192` | [LIVE] **501 Not Implemented** | | |
| `GET /sites/{id}/departures` | [LIVE] 200 | 1.6-45 KB (gzip: 43 KB -> 4.8 KB) | 0.07-0.17 s |
| `GET /lines?transport_authority_id=1` | [LIVE] 200 | 224 KB; keys metro/tram/train/bus/ship/ferry/taxi | 0.4 s |
| `GET /lines` (no param) | [LIVE] 400 (param required) | | |
| `GET /stop-points` | [LIVE] 200 | **8.1 MB** | 3.9 s |
| `GET /transport-authorities` | [LIVE] 200 | 2.9 KB | 0.2 s |

Site object: `{id, gid, name, note?, alias?[], abbreviation?, lat, lon, valid}`.
- [LIVE] For all 6 503 sites, `gid == 9091001000000000 + id`. All site ids are 3-4 digits (max 9999).
- `alias` matters for search. Example: site 5006 is named "Sky City/Terminal 4 och 5" with alias "Arlanda Sky City/Terminal 4 och 5".

### Departures: `GET /sites/{siteId}/departures`
Query params from the spec, all tested [LIVE]:
- `transport` = BUS | TRAM | METRO | TRAIN | FERRY | SHIP | TAXI. **Uppercase only** (`metro` gives 400). **Not repeatable** (`transport=METRO&transport=BUS` gives 400 "not repeatable"; `METRO,BUS` gives 400).
- `line` = integer **line id (not designation)**. Not repeatable. A string gives 400.
- `direction` = 1 | 2 (`3` gives 400 "not less or equal to 2"). Filters on `direction_code`.
- `forecast` = minutes, default 60. Works: forecast=5 gave 5 metro departures, 15 gave 12, 60 gave 30.
- **Hard cap: at most 3 departures per line+direction, whatever the forecast** (line=14&direction=1&forecast=180 still gave 3). So "the next 5 trains on line 14" cannot be answered from one call. The 3 nearest are the most you get.
- Unknown or invalid site id (99999999, stop area 44200, 1005006) gives **200 with an empty list** (`{"departures":[],"stop_deviations":[]}`), not 404.
- Sites 9117 "Odenplan" and 1079 "Stockholm Odenplan" return identical departures (same stop areas 1131/10151/5320). The same holds for T-Centralen 9001 and Centralen 1002, which share most stop areas.

Departure object [LIVE]:
```json
{"destination":"Mörby centrum","direction_code":1,"direction":"Mörby centrum","state":"EXPECTED",
 "display":"2 min","scheduled":"2026-11-03T22:05:06","expected":"2026-11-03T22:06:33",
 "journey":{"id":2026110320963,"state":"NORMALPROGRESS","prediction_state":"NORMAL"},
 "stop_area":{"id":1011,"name":"Slussen","type":"METROSTN"},
 "stop_point":{"id":2011,"name":"Slussen","designation":"2"},
 "line":{"id":14,"designation":"14","transport_authority_id":1,"transport_mode":"METRO",
         "group_of_lines":"Tunnelbanans röda linje"},
 "deviations":[]}
```
- Times are **local time without offset** (Journey Planner uses UTC "Z").
- `display` is "Nu", "N min" or "HH:MM". `expected` minus `scheduled` = delay.
- `state` values seen: EXPECTED, ATSTOP.
- `group_of_lines` values: "Tunnelbanans röda/gröna/blå linje", "Pendeltåg", "Blåbuss", "Tvärbanan", "Roslagsbanan", "Saltsjöbanan", "Lidingöbanan", "Nockebybanan", "Spårväg City", "Ersättningsbuss", "Närtrafiken", or null.
- Destination "43X" has line.id 43, designation "43X".
- Metro at Slussen [LIVE]: dir 1 = 13 Ropsten, 14 Mörby centrum, 17/19 Odenplan, 18 Alvik, 19 Hässelby strand. Dir 2 = 13 Norsborg, 14 Fruängen, 17 Skarpnäck, 18 Farsta strand, 19 Hagsätra.

Example URLs:
- https://transport.integration.sl.se/v1/sites/9192/departures?transport=METRO&forecast=30
- https://transport.integration.sl.se/v1/sites/9192/departures?line=14&direction=1
- https://transport.integration.sl.se/v1/sites/9001/departures?transport=TRAIN

### Lines: `GET /lines?transport_authority_id=1` [LIVE]
- Metro: 10, 11 (blå), 13, 14 (röda), 17, 18, 19 (gröna).
- Tram/local rail: 7 Spårväg City, 12 Nockebybanan, 21 Lidingöbanan, 25/26 Saltsjöbanan, 27/28/29 Roslagsbanan, 30/31 Tvärbanan.
- Train: 40, 41, 42, 43, 44, 48. Ship: 5 lines. Bus: 553 lines.
- **line.id != designation for replacement buses.** 21 designations are ambiguous, for example:
  - "14" = metro id 14 AND bus id 924 ("Ersätter Tunnelbanan")
  - "13" = metro 13 / bus 913
  - "25" = tram 25 / buses 925, 957, 958, 965
- So "line 14" should resolve to the non-replacement line first. Departures and Deviations both filter on **id**.

---
## 2. Journey Planner v2: https://journeyplanner.integration.sl.se/v2

### `GET /stop-finder?name_sf=...&type_sf=any&any_obj_filter_sf=2`
- [LIVE] All three params are required. Without `any_obj_filter_sf` you get 400 (APIKIT). `type_sf` enum is `any` | `coord`; `type_sf=stop` gives 400.
- `any_obj_filter_sf`: 2 = stops, 12 = streets/addresses, 32 = POI, 46 = all. [LIVE] 46 for "slussen" added a POI "Hilton Stockholm Slussen". 12 for "drottninggatan 10" gave a `singlehouse`. 32 for "kungliga tekniska" gave a `poi`.
- **No max-results parameter.** `anyMaxSizeHitList`, `any_max_size_hit_list`, `max_results` and `limit` are all silently ignored. A query for "centrum" returned 11 results. Most queries return 1-9.
- Size 0.6-5 KB, latency 55-105 ms. Fast and small: **use this for find_stop instead of downloading /sites.**
- Results are **not strictly sorted by matchQuality**, and `isBest` is a fuzzy-name score, not relevance. For "arlanda", `isBest` = Arlandagymnasiet (mq 953). Arlanda central (pendeltåg) has mq 950 and comes first in the list. Return several candidates with their modes and let the model pick. Do not auto-pick `isBest`.
- systemMessages: `-8010 "input uniquely verified"` (type message) for a single match. `-8011 ""` (type "error") whenever there are several matches. **Ignore it when `locations` is non-empty** (the docs say so too).
- Case and spelling [LIVE]: "SLUSSEN", "slussen" and the misspelling "slusen" (mq 990) all return Slussen 9192 as best. "odenpln" returns Odenplan. "tekniska" alone returns Tekniska högskolan. "sodertalje centrum" (no diacritics) works, but mq drops from 1000 to 863. Bus-only stop "abborrkroksvägen" returns site 4432, productClasses [5]. Commuter rail: "flemingsberg" returns 9526 [0,5,14] plus several others. "t-centralen" returns 9001. "centralen" returns 1002 Centralen (best) and 9001 T-Centralen.
- Location object: `{id, isGlobalId, name:"Stockholm, Slussen", disassembledName:"Slussen", coord:[lat,lon], type:"stop", matchQuality, isBest, productClasses:[...], parent:{locality}, properties:{stopId, mainLocality}}`.
- productClasses: 0 = pendeltåg, 2 = tunnelbana, 4 = spårväg/lokalbana, 5 = buss, 9 = båt, 14 = fjärrtåg. These match `incl_mot_N` in /trips. Sometimes the field is absent (Flemingsbergs centrum).

### Id formats and the site-id rule [LIVE, validated on 60 random sites plus the named tests]
- `9091 001 VVV SSSSSS` (16 digits) = **Site** (stop group). The last 6 digits are the Transport API site id. VVV is a name-variant/alias counter: 000 for the main name, 001/002/003 for aliases.
  - `9091001000009192` gives 9192 (Slussen).
  - `9091001001005006` "Arlanda Sky City/Terminal 4 och 5" gives **5006** (the last 7 digits would give 1005006, which is wrong: departures returns 200 with an empty list).
  - `9091001002003426` "Brandstationen" and `9091001003003426` "Polishögskolan (Brandstationen)" both give 3426.
  - In the 60-site sample, 87/91 ids worked with the last-7 rule and the other 4 needed the last-6 rule. **Rule: `siteId = Number(id.slice(-6))` when `/^9091001\d{9}$/`.** Then dedupe by siteId. The target site was found for 60/60 sampled names, at rank 0 in 55 cases.
- `9021 001 0SSSSS 000` = **StopArea** that belongs to no Site. Examples: `9021001044200000` "Slussen" (bus, stop area 44200) and `9021001057308000` "Arlanda terminal 5 buss". [LIVE] Neither stop area appears in any site's `stop_areas` (checked with /sites?expand=true), and `/sites/44200/departures` returns an empty list. **These cannot be used for departures.** Drop them, or map them to the nearest site by coordinates. They are fine as trip origin/destination ids... except that a trip from 9021001044200000 returned no journeys (warning -4000 "itp").
- `properties.stopId` "18xxxxxx" is **not reliable**: 18007043 for site 7001, 18005398 for site 5006, 18100138 for a stop area. Do not use it.
- Other id types: `poiID:...`, `streetID:...`, `coord:x:y:MRCV:...`. Pass them unchanged to /trips.
- [DOCS] The Transport doc's conversion rule ("3BA1CDEFG to ABCDEFG", 300109001 to 9001) applies to the OLD SL Stop Lookup API, not to Journey Planner ids.

### Nearby stops / search by coordinates
- [LIVE] `stop-finder?type_sf=coord&name_sf=18.0717:59.3195:WGS84[dd.ddddd]&any_obj_filter_sf=2` (format is lon:lat) returns **only the reverse-geocoded address** ("Peter Myndes backe 3"), never stops, with any filter (2, 32, 46).
- [LIVE] `/v2/coord`, `/v2/coord-request` and `/v2/nearby-stops` all return 404.
- **There is no keyless server-side nearby-stops search.** For "hållplatsen närmast mig", compute the nearest sites client-side from cached `/sites` (lat/lon; 328 KB gzipped, cache for 24 h; a haversine over 6.5k points is trivial). Alternatively pass the coordinate directly to /trips as the origin (that works).

### `GET /trips` [LIVE]
- Required: `type_origin`, `name_origin`, `type_destination`, `name_destination`, `calc_number_of_trips` (0-3; 4 gives 400; 0 gives an empty list).
- `name_*` must be a stop-finder **id** or a coord `lon:lat:WGS84[dd.ddddd]` with `type_*=coord`. Plain names ("odenplan") give no journeys and the messages "origin: multiple matches" / "destination: multiple matches".
- Sizes for Odenplan (9091001000009117) to Arlanda central (9091001000009511):
  - 3 trips: **156 KB** by default (coordinates included).
  - `gen_c=false`: **61 KB** (5.8 KB gzipped), 0.35-0.7 s.
  - 1 trip with `gen_c=false`: 20 KB.
  - **Always send `gen_c=false`, plus Accept-Encoding gzip.**
- By default it also returns a trip *before* now (the first result had already left). **`calc_one_direction=true` fixes this** [LIVE].
- `itd_date=YYYYMMDD&itd_time=HHMM&itd_trip_date_time_dep_arr=arr` works [LIVE].
- `incl_mot_5=false` (no bus) works [LIVE].
- `language=en` is accepted. [DOCS] Disruption texts stay in Swedish.
- Times are UTC with a "Z" suffix (convert to Europe/Stockholm).
- Response: `journeys[]` with `{tripDuration, tripRtDuration, interchanges, legs[]}`.
  - Each leg: `{duration, origin{name, departureTimePlanned, departureTimeEstimated}, destination{name, arrivalTimePlanned, arrivalTimeEstimated}, transportation{disassembledName:"40", number:"Pendeltåg 40", product{class, name:"Tåg"}, destination{name:"Uppsala C"}}, stopSequence[], infos[]}`.
  - Footpath legs have `transportation.product.name = "footpath"`.
- Other params in the spec [DOCS only, not tested]: via/not_via, max_changes, route_type (leastinterchange|leasttime|leastwalking), line/operator exclusion.
- `GET /system-info` [LIVE] returns `{"validity":{"from":"2026-08-02","to":"2027-06-20"}}` (72 B).
- `GET /line-list?line_list_subnetwork=tfs&line_list_branch_code=2` [LIVE] returns an empty list. I don't know the correct subnetwork value. It isn't needed; use Transport /lines.
- Example URL: https://journeyplanner.integration.sl.se/v2/trips?type_origin=any&name_origin=9091001000009117&type_destination=any&name_destination=9091001000009511&calc_number_of_trips=3&gen_c=false&calc_one_direction=true

---
## 3. Deviations: https://deviations.integration.sl.se/v1/messages
All filters are server-side [LIVE]:

| Query | Result |
|---|---|
| (none) | 154 messages, **224 KB** (37 KB gzipped), 0.09 s |
| `future=true` | 175 messages, 265 KB (adds planned future deviations) |
| `line=14` | 1 msg, 1.6 KB (filters by **line id**, and the message's scope lists 13+14) |
| `line=13&line=14` | 3 msgs, 3.5 KB. **Repeatable** (unlike Transport) |
| `line=924` | [] (the replacement-bus id is a different line) |
| `line=43X` | 400 (integer only) |
| `transport_mode=METRO` | 4 msgs, 6.4 KB. Uppercase only; `metro` gives 400 |
| `transport_mode=METRO&transport_mode=BUS` | repeatable, 146 msgs |
| `site=9192` | 1 msg (bus 57/76 at Slussen), 1.3 KB. Takes **site ids**; stop area id 1011 gives [] |
| `site=9001` | [] |
| `transport_authority=1` | same as no filter |

Message shape:
- `{deviation_case_id, version, created, modified, publish{from, upto}, priority{importance_level, influence_level, urgency_level}, message_variants[{header, details, scope_alias:"Tunnelbanans röda linje 13, 14", language:"sv"}], scope{stop_areas[{id, name, type}], lines[{id, designation, transport_mode, name:"Röda linjen", group_of_lines:"tunnelbanans röda linje"}]}}`
- [LIVE] All 175 messages had exactly 1 variant, language "sv". There is no English text.
- These are announced disruptions (works, closures, replacement traffic). Real-time lateness is NOT here. For that, use departures `expected` vs `scheduled`, or `deviations[]`/`stop_deviations[]` in departures (empty in all my tests).
- Example URL: https://deviations.integration.sl.se/v1/messages?line=13&line=14

---
## Latency/size summary [LIVE]
| Call | Size | Time |
|---|---|---|
| stop-finder | 0.6-5 KB | 55-105 ms |
| departures, filtered (line+dir) | 1.7 KB | 70-130 ms |
| departures, transport=METRO at Slussen | 16 KB | 125 ms |
| departures, all at Odenplan | 36 KB (gzip ~4-5 KB) | 165 ms |
| deviations, filtered | 1-6 KB | 40-100 ms (one 1.1 s outlier) |
| deviations, all | 224 KB / 37 KB gz | 90-170 ms |
| trips, 3, gen_c=false | 61 KB / 6 KB gz | 350-700 ms |
| /sites | 1.35 MB / 328 KB gz | 0.6-1 s |
| /lines?transport_authority_id=1 | 224 KB | 0.4 s |
| /stop-points | 8.1 MB | 3.9 s (avoid) |

---
## User questions mapped to tool calls (design sketch)
- "När går nästa tunnelbana från Slussen mot Ropsten?"
  1. find_stop("Slussen") gives 9192.
  2. get_departures(9192, mode=METRO, towards="Ropsten") calls the API with transport=METRO. The tool then filters `destination`/`direction` client-side for "Ropsten" (case- and diacritic-insensitive) and returns 13 to Ropsten.
  - "mot T-Centralen" (an intermediate stop) can't be solved from the destination text alone. The model has to use direction_code: group the output by line+direction with the destinations shown, and let the model choose.
- "Is the red line delayed?"
  - The tool maps colour names statically: röd/red = 13,14; grön/green = 17,18,19; blå/blue = 10,11; pendeltåg = 40-48.
  - It then calls get_disruptions(line="red") with `messages?line=13&line=14`.
  - For lateness right now, also offer get_departures at a central station with line=13 and line=14 (2 calls, because line is not repeatable) and report expected minus scheduled.
- "How do I get from Odenplan to Arlanda?"
  1. find_stop(Odenplan) and find_stop(Arlanda). The second returns several candidates: Arlanda central (pendeltåg) and Arlandagymnasiet (isBest!).
  2. plan_trip(originId, destId) calls /trips with calc_number_of_trips=3, gen_c=false, calc_one_direction=true, and returns a compact summary of legs.
- "Nästa buss från hållplatsen närmast mig"
  - Needs coordinates from the client. There is no server-side nearby search, so the tool finds the nearest sites from cached /sites (lat/lon).
  - Then get_departures(site, mode=BUS).
