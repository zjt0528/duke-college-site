from pathlib import Path
from copy import deepcopy
import json,csv
root=Path('output/verified-answer-imports')
backup=Path('output/answer-audit/before-formatting');backup.mkdir(parents=True,exist_ok=True)
issues=json.loads(Path('output/answer-audit/issues.json').read_text(encoding='utf-8'))
fixes={'self ish':'selfish','am used':'amused','st iff':'stiff','mo ment':'moment','scrum ptious':'scrumptious','am aze':'amaze','form ed':'formed','com fort':'comfort','r emembered':'remembered','m eetings':'meetings','c ompromise':'compromise','s trumming':'strumming'}
changes=[]
for lev in ['2c','3a','3b','3c']:
 p=root/f'reading-vocabulary-{lev}.json'
 original=p.read_text(encoding='utf-8');before=json.loads(original);after=deepcopy(before)
 lookup={w['code']:w for w in after['worksheets']}
 for item in issues:
  if not item['worksheet'].startswith(lev) or item['severity']!='排版修正':continue
  q=lookup[item['worksheet']]['questions'][item['question']-1]
  if item['worksheet']=='3c8' and item['question']==1:
   old=q['prompt'];new=old.replace('e quipment','equipment');q['prompt']=new;field='prompt'
  elif item['worksheet']=='3a24' and item['question']==4:
   old=q['prompt'];new=old.replace('scrum ptious','scrumptious');q['prompt']=new;field='prompt'
  else:
   index=q['correct_index'];old=q['choices'][index];new=fixes[old];q['choices'][index]=new;field=f'choices[{index}]'
  assert new!=old
  changes.append([lev,item['worksheet'],item['question'],field,old,new])
 if lev=='2c':
  for code,n,old,new in [
   ('2c2',15,'Something must be wrong with him. _____ He looks very _____ today.','Something must be wrong with him. He looks very _____ today.'),
   ('2c5',14,'Watch out! _____ A _____ man is coming.','Watch out! A _____ man is coming.')]:
   q=lookup[code]['questions'][n-1];assert q['prompt']==old;q['prompt']=new;changes.append([lev,code,n,'prompt',old,new])
 # Preserve every answer index, worksheet identity, title, question order and non-format content.
 for a,b in zip(before['worksheets'],after['worksheets']):
  assert {k:v for k,v in a.items() if k!='questions'}=={k:v for k,v in b.items() if k!='questions'}
  assert len(a['questions'])==len(b['questions'])==15
  for n,(qa,qb) in enumerate(zip(a['questions'],b['questions']),1):
   assert qa['correct_index']==qb['correct_index']
   for field in ['prompt','choices']:
    va=qa[field];vb=qb[field]
    if va==vb:continue
    if field=='choices':assert [''.join(s.split()) for s in va]==[''.join(s.split()) for s in vb]
    elif (a['code'],n) not in [('2c2',15),('2c5',14)]:assert ''.join(va.split())==''.join(vb.split())
 (backup/p.name).write_text(original,encoding='utf-8')
 p.write_text(json.dumps(after,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert len(changes)==20
with Path('output/answer-audit/formatting-changes.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['册别','练习','题号','字段','修正前','修正后']);w.writerows(changes)
with (root/'README.md').open('a',encoding='utf-8') as f:
 f.write('\n排版更新：按用户要求修复18项已记录的词内断空格，以及2c2第15题、2c5第14题由提取产生的多余填空，共20处。所有答案索引不变；文字优化、原稿问题和答案歧义未处理。更改明细见 output/answer-audit/formatting-changes.csv。\n')
print('Applied 20 formatting fixes. All 1,440 answer indices and worksheet identities preserved.')
