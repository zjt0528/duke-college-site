"""Apply user-supplied 2c/3a/3b/3c answer images to full import files."""
from pathlib import Path
import json,csv
ROWS = [
 'DBBCABCCDCACDAC', 'BACDBCACACDDCBA', 'CABDBCDCCABCBAD',
 'DCABDCBDACDBACB', 'ACDBCADBBCDBCAD', 'CABDDBBCABDABBD',
 'BDCABACDBCDBDAC', 'ABCDCABDBCABCDB', 'BDCCDCABDCBABCA',
 'DBACACDBCAD DACB'.replace(' ',''), 'BADCCABDCADCBDA', 'CDBCADBCDAACBBD'
]
assert len(ROWS)==12 and all(len(r)==15 and set(r)<=set('ABCD') for r in ROWS)
OUT=Path('output/verified-answer-imports'); OUT.mkdir(parents=True,exist_ok=True)
changes=[]; counts=[]
for level in ['2c','3a','3b','3c']:
 source=Path(f'output/question-banks/reading-vocabulary-{level}.json')
 data=json.loads(source.read_text(encoding='utf-8'))
 result=[]; pending=[]
 for ws in data['worksheets']:
  n=int(ws['code'][len(level):])
  if level=='3c':
   if n==12:
    pending.append(ws['code']);continue
   row=11 if n in [24,25] else (n-1)%12
  else:row=(n-1)%12
  answer=ROWS[row]
  assert len(ws['questions'])==15,(level,ws['code'])
  for number,(q,a) in enumerate(zip(ws['questions'],answer),1):
   old=q['correct_index']; new=ord(a)-65
   if old!=new:changes.append([level,ws['code'],number,chr(old+65),a,q['prompt'],q['choices'][old],q['choices'][new]])
   q['correct_index']=new
  result.append(ws)
 suffix='-pending-3c12' if pending else ''
 (OUT/f'reading-vocabulary-{level}{suffix}.json').write_text(json.dumps({'worksheets':result},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 counts.append({'level':level,'worksheets':len(result),'questions':sum(len(w['questions']) for w in result),'pending':pending})
with (OUT/'answer-changes.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.writer(f);writer.writerow(['级别','练习','题号','旧推导答案','图片答案','题目','旧选项内容','新选项内容']);writer.writerows(changes)
(OUT/'manifest.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(counts,ensure_ascii=False));print('changed answers:',len(changes))
