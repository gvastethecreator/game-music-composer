#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,statistics
from pathlib import Path

def polyphony(events):
    pts=[]
    for e in events:
        if e.get('performance_mute'):continue
        s=float(e.get('performance_beat',e['beat']));d=float(e.get('performance_duration',e.get('duration',.14 if e['kind']=='drum' else .25)));pts.extend([(s,1),(s+max(.04,d),-1)])
    a=m=0
    for _,delta in sorted(pts,key=lambda x:(x[0],x[1])):a+=delta;m=max(m,a)
    return m

def main():
    ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('--output',type=Path);args=ap.parse_args();d=json.loads(args.catalog.read_text());rows=[]
    for s in d['styles']:
        ev=[e for e in s['events'] if not e.get('performance_mute')]
        offsets=[abs(float(e.get('start_offset_ms',0))) for e in ev];gains=[round(float(e.get('performance_gain',1)),4) for e in ev];durations=[round(float(e.get('duration_scale',1)),4) for e in ev if e['kind']=='note']
        row={'id':s['id'],'mode':d['mode'],'events':len(ev),'max_polyphony':polyphony(ev),'ensemble_layers':sum(bool(e.get('_layer')) for e in ev),'mean_abs_timing_ms':round(statistics.fmean(offsets),3) if offsets else 0,'max_abs_timing_ms':round(max(offsets),3) if offsets else 0,'distinct_gain_values':len(set(gains)),'distinct_duration_scales':len(set(durations)),'independent_random_jitter':s['performance'].get('independent_random_jitter')}
        limit=7 if d['mode']=='strict_hardware' else 16;row['pass']=row['max_polyphony']<=limit and row['max_abs_timing_ms']<=65 and row['distinct_gain_values']>=8 and row['distinct_duration_scales']>=5 and not row['independent_random_jitter'];rows.append(row)
    report={'mode':d['mode'],'pass':all(r['pass'] for r in rows),'styles':rows}
    text=json.dumps(report,indent=2);print(text)
    if args.output:args.output.write_text(text)
if __name__=='__main__':main()
